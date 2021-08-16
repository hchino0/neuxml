/**
 * 歌詞をパースするクラス
 */
class LyricsParser
{
    /**
     * 歌詞をパースして、音ごとに対応する歌詞要素の配列を返す。
     * @param {string} l 歌詞
     * @returns 歌詞要素[歌詞, ブレス有無]の配列
     */
    Parse(l)
    {
        let items = []
        const lyrics = l.replaceAll(/\s/g,'') //空白を削除
        let ret // 返り値
        for(let i=0; i < lyrics.length; i++){
            switch(lyrics[i]){
                case '[':
                    ret = this.kakko(lyrics, i)
                    items.push(ret.element)
                    i = ret.end
                    break
                case '(':
                    ret = this.paren(lyrics, i)
                    items = items.concat(ret.elements)
                    i = ret.end
                    break
                case ',':
                    if(items.length === 0){
                        throw new Error("不正な,です。")
                    }
                    items[items.length - 1][1] = true
                    break
                case '/':
                    if(items.length === 0){
                        throw new Error("不正な/です。")
                    }
                    items[items.length - 1][0] += '’'
                    break
                case ']':
                    throw new Error("不正な]です。")
                case ')':
                    throw new Error("不正な)です。")
                default:
                    items.push([lyrics[i], false])
            }
        }
        return items
    }
    /**
     * []内を解釈・処理する
     * @param {string} lyrics 歌詞
     * @param {number} i 解釈開始位置
     * @returns []内の歌詞要素と現在の読み込み位置
     * @throws ]がない場合
     * @throws []内が空の場合
     */
    kakko(lyrics, i)
    {
        const at = lyrics.indexOf("]", i)
        if(at === -1){
            throw new Error("]がありません。")
        }
        let str = lyrics.substring(i + 1, at)
        str = str.replaceAll(/[,[()]/g, "")// 指示記号を取り除く
        str = str.replace("/", "’")// 母音脱落
        if(str.length === 0){
            throw new Error("[]の内容が空。")
        }
        return {element: [str, false], end: at}
    }
    /**
     * ()内を解釈・処理する
     * @param {string} lyrics 歌詞
     * @param {number} i 解釈開始位置
     * @returns ()内の歌詞要素(無音)と現在の読み込み位置
     * @throws )がない場合
     * @throws ()内が空の場合
     */
    paren(lyrics, i)
    {
        let at = lyrics.indexOf(")", i)
        if(at === -1){
            throw new Error(")がありません。")
        }
        let str = lyrics.substring(i + 1, at)
        str = str.replaceAll(/[,/(]/g, "")// 指示記号を取り除く
        if(str.length === 0){
            throw new Error("()の内容が空。")
        }
        let count = 0
        for(let j=0; j < str.length; j++){
            if(str[j] === '['){
                const ret = this.kakko(str, j)
                j = ret.end
            }
            count++
        }
        if(count === 0){
            throw new Error("()の内容が空。")
        }
        return {elements: Array(count).fill(0).map(()=>{return ['-', false]}), end: at}
    }
}

export default LyricsParser