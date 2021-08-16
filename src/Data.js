
import {MIDIReader} from "MIDIReader"
import LyricsParser from "LyricsParser"

/**
 * 再描画指示用クラス
 */
class Redraw{}

/**
 * データを集約するクラス
 */
class Converter
{
    fileInfo = null
    lyrics = ""// ダウンロード画面からメインに遷移したときに復帰させるためのバッファ
    transpose = 0 // 移調
    trackList = null
    iSelectedTrack = -1
    nNotePage = 10//１ページのノート数
    curPage = 0
    numPage = 0
    resolution = 0
    FileLoadState = 0//0: 読み込み前 1: 読み込み中 2: 読み込み後
    UploadState = 0//0:アップロード前 1: アップロード中・応答待ち 2: ダウンロード完了
    xml = null
    redraw = null
    setPageNum = null// ノートリストのページ番号をセットする関数(モーダル用)
    /**
    *MIDIファイルを読み込んで内部データを作成する
    */ 
    Read()
    {
        const reader = new FileReader()
        reader.onloadend = () =>
        {
            try{
                const midireader = new MIDIReader(new Uint8Array(reader.result))
                midireader.Read()
                this.trackList = midireader.tracks
                this.iSelectedTrack = -1
                this.curPage = 0
                this.numPage = 0
                this.resolution = midireader.resolution
                this.FileLoadState = 2
                this.redraw(new Redraw())
            }catch(e){
                console.log(e)
                alert("ファイルの読み込みに失敗しました。")
            }
        }
        this.trackList = null
        this.FileLoadState = 1
        reader.readAsArrayBuffer(this.fileInfo)
        this.redraw(new Redraw())
    }
    /**
     * 
     * @param {number} index 選択されたトラックのインデックス
     */
    SelectTrack(index)
    {
        this.iSelectedTrack = index
        this.numPage = Math.ceil(this.trackList[index].events.length / this.nNotePage)
        this.curPage = 0
    }
    /**
    *MIDIファイルを読み込んである前提で、歌詞を適用する。
    *@param {string} lyrics 歌詞
    */ 
    ApplyLyrics(lyrics)
    {
        if(this.trackList === null || this.iSelectecTrack === -1){
            alert("MIDIファイルを読み込み、トラックを選択してください。")
            return
        }
        const text = lyrics.trim()
        if(text.length === 0){
            alert("歌詞を入力してください。")
            return
        }
        let chars
        try{
            chars = new LyricsParser().Parse(lyrics)
        }catch(e){
            alert("歌詞の書式が正しくありません: " + e.message)
            return
        }
        // クリア
        for(let i=0; i < this.trackList[this.iSelectedTrack].events.length; i++){
            this.trackList[this.iSelectedTrack].events[i].text = ""
            this.trackList[this.iSelectedTrack].events[i].breath = false
        }
        // 適用
        for(let i=0; i < chars.length; i++){
            if(this.trackList[this.iSelectedTrack].events.length <= i){
                break
            }
            this.trackList[this.iSelectedTrack].events[i].text = chars[i][0]
            this.trackList[this.iSelectedTrack].events[i].breath = chars[i][1]
        }
        this.redraw(new Redraw())
    }
    /**
     * 再描画する
     */
    Redraw()
    {
        this.redraw(new Redraw())
    }
    /**
     * ページが範囲内かどうかチェック
     * @param {number} page ページ
     * @returns 範囲内かどうか
     */
    IsValidPage(page){
        if(this.trackList === null || this.iSelectedTrack === -1 || this.numPage === 0 || page < 0 || this.numPage <= page){
            return false
        }
        return true
    }
    /**
    *ノートリストを返す
    */ 
    GetNoteList(page)
    {
        if(!this.IsValidPage(page)){
            return null
        }
        const start = page * this.nNotePage
        if(start + this.nNotePage < this.trackList[this.iSelectedTrack].events.length){
            return this.trackList[this.iSelectedTrack].events.slice(start, start + this.nNotePage)
        }
        return this.trackList[this.iSelectedTrack].events.slice(start)
    }
}

export default Converter