/**
 * メロディの音程データ
 */
class MIDINote
{
    at
    nn
    len
    text
    breath
    /**
     * 初期化
     * @param {number} at 開始位置
     * @param {number} nn MIDIノート番号
     * @param {number} len 長さ(ticks)
     */
    constructor(at, nn, len)
    {
        this.at = at
        this.nn = nn
        this.len = len
        this.text = ""
        this.breath = false
    }
}

/**
 * テンポチェンジ情報
 */
class MIDITempo
{
    at
    tempo
    /**
     * 初期化
     * @param {number} at 開始位置
     * @param {number} tempo テンポ情報(一拍をマイクロ秒で表す)
     */
    constructor(at, tempo)
    {
        this.at = at
        this.tempo = tempo
    }
}

/**
 * MIDIトラック情報
 */
class MIDITrack
{
    name = "MIDITrack"
    events = null
    constructor()
    {
        this.events = []
    }
}

/**
 * MIDIファイルの内容を保持するクラス
 */
class MIDIData
{
    data
    i
    mark
    /**
     * 初期化
     * @param {uint[]} data ファイルの内容をuintの配列に変換した物
     */
    constructor(data)
    {
        this.data = data
        this.i = 0
    }
    /**
     * ファイルの長さを返す。
     * @returns ファイルの長さ
     */
    length(){return this.data.length}
    /**
     * ファイルデータから指定の文字数を読み込む
     * @param {number} nChar 読み込む文字数
     * @returns 文字を格納した配列
     */
    next(nChar=1)
    {
        if(nChar === 1){
            return this.data[this.i++]
        }
        const buff = this.data.slice(this.i, this.i+nChar)
        this.i += nChar
        return buff
    }
    /**
     * 現時点の1文字を返す。
     * @returns 現時点の1文字
     */
    cur(){return this.data[this.i]}
    /**
     * 指定の文字数を読み飛ばす。
     * @param {number} nChar 読み飛ばす文字数
     */
    skip(nChar){this.i += nChar}
    /**
     * ファイル最後尾に到達したかを判定する。
     * @returns ファイル最後尾に到達したか
     */
    isEnd(){return !(this.i < this.data.length)}
    /**
     * トラック終端を検知するために終端にマークを付ける。
     * @param {number} nCharAhead マークを付ける位置
     */
    setMark(nCharAhead){this.mark = this.i + nCharAhead}
    /**
     * トラック終端に到達したかを判定する。
     * @returns マークに到達したか
     */
    isMarkReached(){return !(this.i < this.mark)}
    /**
     * MIDIファイル専用の可変長数を読み込む
     * @returns 数値
     */
    ReadVarNum()
    {
        const buff = [0,0,0,0]
        for(let j=0; j < 4; j++){
            buff[j] = this.data[this.i++]
            if((buff[j] & 0x80) === 0){
                return this.decode(buff, j+1)
            }
        }
        throw new Error("Deltatime corrupt")
    }
    /**
     * 可変長数デコード(private)
     * @param {uint[]} buff 読み込む元のバッファ
     * @param {int} size buffのサイズ
     * @throws フォーマット不正
     * @returns 数
     */
    decode(buff, size)
    {
        switch(size){
            case 1:
                return buff[0]
            case 2:
                return ((buff[0] & 0x7f) << 7) + (buff[1] & 0x7f)
            case 3:
                return ((buff[0] & 0x7f) << 14) + ((buff[1] & 0x7f) << 7) + (buff[2] & 0x7f)
            case 4:
                return ((buff[0] & 0x7f) << 21) + ((buff[1] & 0x7f) << 14) + ((buff[2] & 0x7f) << 7) + (buff[3] & 0x7f)
            default:
                throw new Error("Deltatime format")
        }
    }
}

/**
 * MIDIファイルを解釈するクラス
 */
class MIDIReader
{
    at = 0
    resolution = 0
    data = null
    tracks = []
    // 発音中ノートのインデックスを格納
    keyboard = Array(127).fill(-1)
    /**
     * 初期化
     * @param {uint[]} data 
     */
    constructor(data)
    {
        this.data = new MIDIData(data)
    }
    /**
     * コンダクタートラックを返す
     * @returns コンダクタートラック
     */
    condTrack()
    {
        return this.tracks[0]
    }
    /**
     * 現在トラックを返す
     * @returns 現在トラック
     */
    curTrack(){
        if(this.tracks.length === 1){
            // テンポデータとノートデータが混在する場合(フォーマット0)
            this.tracks.push(new MIDITrack())
        }
        return this.tracks[this.tracks.length - 1]
    }
    /**
     * MIDIファイルの解釈
     */
    Read()
    {
        let buff = this.data.next(4)
        // MThd
        if(buff[0] !== 77 || buff[1] !== 84 || buff[2] !== 104 || buff[3] !== 100){
            throw new Error("MThd")
        }
        buff = this.data.next(4)
        const sizeHeader = (buff[0] << 24) + (buff[1] << 16) + (buff[2] << 8) + buff[3]
        this.data.skip(4)
        buff = this.data.next(2)
        this.resolution = ((buff[0] & 0x7f) << 8) + buff[1]
        this.data.skip(sizeHeader - 6)
        while(!this.data.isEnd()){
            this.ReadTrack()
        }
    }
    /**
     * MIDIトラックの解釈
     */
    ReadTrack()
    {
        let buff = this.data.next(4)
        // MTrk
        if(buff[0] !== 77 || buff[1] !== 84 || buff[2] !== 114 || buff[3] !== 107){
            throw new Error("MTrk")
        }
        this.tracks.push(new MIDITrack())
        buff = this.data.next(4)
        const sizeTrack = (buff[0] << 24) + (buff[1] << 16) + (buff[2] << 8) + buff[3]
        this.data.setMark(sizeTrack)
        this.at = 0
        let status = 0//ランニングステータス用
        while(!this.data.isMarkReached()){
            this.at += this.data.ReadVarNum()
            if(this.data.cur() === 0xff){
                // メタデータ
                status = 0
                this.ReadMetaData()
            }else if(this.data.cur() === 0xf0 || this.data.cur() === 0xf7){
                // エクスクルーシブ(無視)
                status = 0
                this.data.next()
                const len = this.data.ReadVarNum()
                this.data.skip(len)
            }else if((this.data.cur() & 0x80) === 0){
                // ランニングステータス
                if(status === 0){
                    throw new Error("ランニングステータスが存在しない")
                }
                 this.ReadMessage(status, true)
            }else{
                // 通常メッセージ
                status = (this.data.cur() & 0xf0)
                this.ReadMessage(status, false)
            }
        }
    }
    /**
     * メタデータの解釈
     */
    ReadMetaData()
    {
        let buff = this.data.next(2)
        const kind = buff[1]
        const len = this.data.ReadVarNum()
        if(kind === 0x51){
            // テンポ
            buff = this.data.next(len)
            this.condTrack().events.push(new MIDITempo(this.at, (buff[0] << 16) + (buff[1] << 8) + buff[2]))
        }else if(kind === 0x3){
            // トラック名
            const name = this.data.next(len)
            try{
                this.tracks[this.tracks.length - 1].name = (new TextDecoder("utf-8", {fatal: true})).decode(name)
            }catch(e){
                try{
                    this.tracks[this.tracks.length - 1].name = (new TextDecoder("shift-jis", {fatal: true})).decode(name)
                }catch(e){
                    this.tracks[this.tracks.length - 1].name = (this.tracks.length-1).toString()
                }
            }
        }else{
            // 無視
            this.data.next(len)
        }
    }
    /**
     * 通常のMIDIメッセージを解釈する。
     * @param {uint} status ステータス
     * @param {boolean} bRunning ランニングステータスかどうか
     */
    ReadMessage(status, bRunning)
    {
        let size = this.SizeShortMsg(status)
        if(bRunning){
            size--
        }
        const buff = this.data.next(size)
        if(status !== 0x90 && status !== 0x80){
            // ノートオン・ノートオフ以外は無視
            return
        }
        const nn = bRunning ? buff[0] : buff[1]
        const vel = bRunning ? buff[1] : buff[2]
        const index = this.keyboard[nn]
        if(status === 0x80 || vel === 0){
            // ノートオフ
            if(index === -1){
                console.log(`[${this.curTrack().events.length}]: ノートオン(${nn})が存在しません。この周辺に同音反復がある場合は無視できることがあります。`)
                // 同音反復によって引き起こされる場合は安全に無視できる。そうでない場合は修復できないためデータ欠落。
                return
            }
            this.curTrack().events[index].len = this.at - this.curTrack().events[index].at
            this.keyboard[nn] = -1    
            return
        }
        // ノートオン
        if(index !== -1){
            // 同音反復
            console.log(`[${this.curTrack().events.length+1}]: 同音反復です。この音(${nn})を短く切り詰めました。`)
            // 最初の音を打ち切る
            this.curTrack().events[index].len = this.at - this.curTrack().events[index].at
        }
        this.curTrack().events.push(new MIDINote(this.at, nn, 0))
        this.keyboard[nn] = this.curTrack().events.length-1
    }
    /**
     * それぞれのコマンドが使用する文字数を返す
     * @param {uint} status ステータス
     * @returns 文字数
     * @throws サポートしていないコマンド
     */
    SizeShortMsg(status)
    {
        switch(status & 0xf0){
            case 0x90:// ノートオン
            case 0x80:// ノートオフ
            case 0xb0:// コントロールチェンジ 
            case 0xe0:// ピッチベンド
                return 3
            case 0xc0:// プログラムチェンジ
            case 0xd0:// チャンネル・アフタータッチ
            case 0xa0:// ポリフォニック・アフタータッチ
                return 2
            default: throw new Error("サポートしていないコマンド: "+status)
        }
    }
}

export {MIDIReader, MIDINote, MIDITempo, MIDITrack}