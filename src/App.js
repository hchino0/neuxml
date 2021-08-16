import React, {useContext, useState} from 'react';
import Converter from 'Data';
import ConverterContext from 'ConverterContext';
import Check from "check.svg"
import 表紙上 from "表紙上.jpg"
import './App.css';

const APIURL = "https://192.168.11.3/neuxml/v1/process"

/**
 * トラック・ノートリスト部分を描画する。
 * @returns トラック・ノートリスト部分
 */
const DataDisplay = () =>
{
  const converter = useContext(ConverterContext)
  const [, setSelected] = useState(converter.iSelectedTrack)
  return(
    <>
      <select id="selectTrack" className="form-select mb-3" value={converter.iSelectedTrack} onChange={e=>{
          converter.SelectTrack(+(e.target.value))
          setSelected(+(e.target.value))
          converter.Redraw()
        }
      }>
        <TrackList/>
      </select>
      <NoteTable/>
    </>
  )
}

/**
 * トラックリストを作成する。
 * @returns トラックリスト
 */
const TrackList = () =>
{
  const converter = useContext(ConverterContext)
  if(converter.trackList === null){
    return(
        <option value={-1}>未選択</option>
    )
  }
  const List = converter.trackList.map((val, i)=>{
      if(i === 0){
          return <option key={i} value={-1}>未選択</option>
      }
      return <option key={i} value={i}>{val.name}</option>
  })
  return <>{List}</>
}

const DlgNotePage = () =>
{
  const converter = useContext(ConverterContext)
  const [numPage, setNumPage] = useState(1)
  const handleChangePageNum = e => {
    setNumPage(+(e.target.value))
  }
  return (
  <div className="modal fade" id="dlgPage" tabIndex={-1} role="dialog" aria-labelledby="basicModal" aria-hidden="true">
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header">
          <h4><div className="modal-title" id="dlgPageTitle">ページを入力してください。</div></h4>
        </div>
        <div className="modal-body">
          <input type="number" className="form-control" value={numPage} min="1" step="1" onChange={handleChangePageNum}/>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default" data-bs-dismiss="modal">閉じる</button>
          <button type="button" className="btn btn-success" data-bs-dismiss="modal" onClick={()=>{converter.setPageNum(numPage-1)}}>移動</button>
        </div>
      </div>
    </div>
  </div>
  )
}

/**
 * ノートリストを作成する。
 * @returns ノートリスト
 */
const NoteTable = () =>
{
  const converter = useContext(ConverterContext)
  const [, setCurPage]=useState(converter.curPage)

  const notelist = converter.GetNoteList(converter.curPage)
  if(notelist === null){
    return <p>ノートデータがありません。</p>
  }
  const notes = notelist.map((val, i)=>{
      const num = converter.curPage * converter.nNotePage + i + 1
      return (
          <tr key={num}><th scope="row">{num}</th><td>{["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][val.nn%12]}</td><td>{`${val.len}ticks`}</td><td>{val.text}</td><td>{val.breath ? "○":""}</td></tr>
      )
  })
  const handlePageChange = page =>{
    if(!converter.IsValidPage(page)){
      return
    }
    converter.curPage = page
    setCurPage(page)
  }
  converter.setPageNum = handlePageChange// モーダルからページを変更
  return(
      <>
      <table className="table">
          <thead><tr><th>番号</th><th scope="col">音名</th><th scope="col">音価</th><th scope="col">歌詞</th><th scope="col">ブレス</th></tr></thead>
          <tbody>
              {notes}
          </tbody>
      </table>
      <ul className="pagination justify-content-end">
          <li className="page-item pt-2 me-1">{converter.curPage+1} / {converter.numPage}ページ</li>
          <li className="page-item"><div className="page-link" style={{cursor: "pointer"}} onClick={()=>{handlePageChange(0)}}>最初へ</div></li>
          <li className="page-item"><div className="page-link" style={{cursor: "pointer"}} onClick={()=>{handlePageChange(converter.curPage - 10)}}>10ページ前へ</div></li>
          <li className="page-item"><div className="page-link" style={{cursor: "pointer"}} onClick={()=>{handlePageChange(converter.curPage - 1)}}>前へ</div></li>
          <li className="page-item"><button type="button" className="btn page-link" data-bs-toggle="modal" data-bs-target="#dlgPage">...</button></li>
          <li className="page-item"><div className="page-link" style={{cursor: "pointer"}} onClick={()=>{handlePageChange(converter.curPage + 1)}}>次へ</div></li>
          <li className="page-item"><div className="page-link" style={{cursor: "pointer"}} onClick={()=>{handlePageChange(converter.curPage + 10)}}>10ページ次へ</div></li>
          <li className="page-item"><div className="page-link" style={{cursor: "pointer"}} onClick={()=>{handlePageChange(converter.numPage - 1)}}>最後へ</div></li>
      </ul>
      </>
  )
}

/**
 * メイン画面を描画する
 * @param {Object} props プロパティ
 * @returns メイン画面
 */
const Create = props =>
{
  const converter = useContext(ConverterContext)
  const [lyrics, setLyrics] = useState(converter.lyrics)
  const [transpose, setTranspose] = useState(converter.transpose)

  /**
   * MIDIファイルを指定・チェックする
   * @param {Object} e イベント情報
   */
  const fileSelected = e =>
  {
      e.preventDefault()
      const fileinfo = e.target.files[0]
      if(fileinfo == null){
          // キャンセル時
          return
      }
      if(!fileinfo.type.match('audio/midi') && !fileinfo.type.match('audio/mid') ) {
          alert("MIDIファイルを選択してください")
          converter.fileInfo = null
          return
      }
      if(1048576 < fileinfo.size){
          alert("ファイルサイズが1Mbを超えています")
          converter.fileInfo = null
          return
      }
      converter.fileInfo = fileinfo
  }
  /**
   * MIDIファイルを読み込む
   */
  const ReadFile = () =>
  {
    if(converter.fileInfo === null) {
      alert("MIDIファイルを選択してください")
      return
    }
    converter.Read()
  }
  /**
   * 歌詞更新
   * @param {Object} e イベント情報
   */
  const handleChange = e =>{
    converter.lyrics = e.target.value
    setLyrics(e.target.value)
  }
  /**
   * 移調情報更新
   * @param {Object} e イベント情報
   */
  const handleChangeTranspose = e =>
  {
    converter.transpose = +(e.target.value)
    setTranspose(e.target.value)
  }
  /**
   * ファイルの読み込み状況を表示する。
   * @param {number} state ファイル読み込み状況
   * @returns 状態表示
   */
  const FileLoadingState = state =>{
    switch(state){
      case 0: return <div className="col-auto"/>
      case 1: return <div className="col-auto spinner-border"/>
      case 2: return <div className="col-auto"><img src={Check} alt="完了" style={{width: "32px"}}/></div>
      default: return <div className="col-auto"/>
    }
  }
  /**
   * MusicXMLを作成する。作成完了したらダウンロードページへ遷移。
   */
  const createMXML = () =>
  {
    if(converter.trackList === null || converter.iSelectedTrack === -1){
      alert("MIDIファイルを読み込み、トラックを選択してください。")
      return
    }
    if(2000 < converter.trackList[converter.iSelectedTrack].events.length){
      alert("一度に処理可能な音数は2000個までです。")
      return
    }
    converter.UploadState = 1
    const data = JSON.stringify({tempo: converter.trackList[0], notes: converter.trackList[converter.iSelectedTrack], resolution: converter.resolution, transpose: converter.transpose})
    const options = {
      method: "POST",
      credentials : "include",
      headers: new Headers({"Content-Type": "application/json"}),
      body: data
    }
    fetch(APIURL, options)
    .then(response=>{
        if(!response.ok){
            throw new Error("失敗")
        }
        return response.json()
    })
    .then(data=>{
      converter.xml = data
      converter.UploadState = 2
      converter.Redraw()
    })
    .catch(err=>{
        alert("処理失敗。しばらくしてから再度実施してください。")
        console.log(err)
    })
    props.setStep("ダウンロード")
  }
  return(
    <div>
      <nav className="navbar navbar-expand-lg bg-dark navbar-dark text-white mb-3 ps-3 fixed-top">NeuXML[β]</nav>
      <div className="container pt-5">
        <p className="mt-3 mb-4">DAW等で作成したMIDIファイルからNEUTRINO用のMusicXMLファイルを作成するツールです。</p>
        <p className="mt-3"><b>想定するユーザ</b></p>
        <ul>
          <li>MusicXMLを出力できないDAWを使用しているユーザ。</li>
          <li>音が重なりがちな、リアルタイム入力のMIDIデータを使用したいユーザ。</li>
          <li>リタルダンドやアッチェレランドなどの、細かいテンポ変化を反映させたいユーザ。</li>
          <li>歌詞をまとめて設定したいユーザ。</li>
        </ul>
        <form className="p-3 mb-3 styleCard">
          <label className="form-label" htmlFor="midiInput">1. MIDIファイルを選択し、「読み込み」ボタンを押してください</label>
          <div className="row">
            <div className="col-auto"><input type="file" className="form-control" id="midiInput" accept="audio/midi" onChange={fileSelected}/></div>
            <div className="col-auto"><button type="button" className="btn btn-primary" onClick={()=>{ReadFile()}}>読み込み</button></div>
            {FileLoadingState(converter.FileLoadState)}
          </div>
        </form>
        <form className="p-3 mb-3 styleCard">
          <label className="form-label" htmlFor="selectTrack">2. トラックを選択してください</label>
          <DataDisplay/>
        </form>
        <form className="p-3 mb-3 styleCard">
          <label className="form-label" htmlFor="lyricsPad"><p>3. 歌詞を入力し、「歌詞流し込み」ボタンを押してください。</p>
          <p><b>指示記号について</b></p>
          <p>,　ブレス</p>
          <p>/　母音脱落</p>
          <p>-　休符に置き換える。なお歌詞未割り当ての音は自動的に休符に置き換えられます。</p>
          <p>[歌詞]　[]内の複数の文字を一つの音に割り当てる。</p>
          <p>(歌詞)　()内の歌詞を休符に置き換える。トラックを分割して個別処理するためのMusicXMLを作る場合等に便利です。</p>
          <p>例: どれみ[ふぁ],-らし/(ど)</p></label>
          <textarea id="lyricsPad" className="form-control mb-1" value={lyrics} style={{lineHeight: 1.3, height: "calc(1.3em * 10)"}} onChange={handleChange}></textarea>
          <button type="button" className="btn btn-primary" onClick={()=>{converter.ApplyLyrics(lyrics)}}>歌詞流し込み</button>
        </form>
        <form className="p-3 mb-3 styleCard">
          <label className="form-label" htmlFor="transform">4. メロディがキャラの声域に合わず声がかすれたりする場合、声域に合うように移調してNEUTRINO側で元に戻すときれいに合成できることがあります。移調の音程を半音単位で指定してください。</label>
          <input type="number" id="transform" className="form-control" value={transpose} min="-12" max="12" step="1" onChange={handleChangeTranspose}/>
        </form>
        <form className="p-3 mb-3 styleCard">
          <p>5. ノートリストの内容が正しいことを確認し「MusicXML作成」ボタンを押してください</p>
          <button type="button" className="btn btn-success" onClick={createMXML}>MusicXML作成</button>
        </form>
      </div>
    </div>
  )
}

/**
 * ダウンロードページを表示する。
 * @param {Object} props プロパティ
 * @returns ダウンロードページ
 */
const Download = props =>
{
  const converter = useContext(ConverterContext)
  /**
   * RESTサーバから受け取ったBLOBをダウンロードするためのリンクを作成し、起動する。
   */
  const download = () =>
  {
    const a = document.createElement("a")
    document.body.appendChild(a)
    a.style = "display:none"
    const blob = new Blob([converter.xml.data], {type: "application/octet-stream"})
    const url = window.URL.createObjectURL(blob)
    a.href = url
    a.download = "score.musicxml"
    a.click()
    window.URL.revokeObjectURL(url)
    a.parentNode.removeChild(a)
  }
  /**
   * 作成画面に遷移する。
   */
  const goback = () =>
  {
    converter.UploadState = 0
    props.setStep("作成")
  }
  const downloadButton = converter.UploadState === 2 ?
    <div className="col-auto"><button type="button" className="btn btn-primary" onClick={download}>ダウンロード</button></div> :
    <div className="col-auto"><button type="button" className="btn btn-primary" disabled onClick={()=>{}}>作成中・・・</button></div>
  return(
    <div>
      <nav className="navbar navbar-expand-lg bg-dark navbar-dark text-white mb-3 ps-3 fixed-top">NeuXML[β]</nav>
      <div className="container pt-5">
      <form className="p-3 mb-3 styleCard">
          <label className="form-label" htmlFor="midiInput">ダウンロードはこちら</label>
          <div className="row">
            {downloadButton}
            <div className="col-auto"><button type="button" className="btn btn-secondary" onClick={goback}>作成画面に戻る</button></div>
          </div>
        </form>
        <div style={{height:"400px"}}/>
      </div>
    </div>
  )
}

/**
 * 現在の画面を判断し、表示する
 * @returns 現在の画面
 */
const Screen = () =>
{
  const [step, setStep] = useState("作成")
  const Screen = step === "作成" ? <Create setStep={setStep}/> : <Download setStep={setStep}/>
  const [, setRedraw] = useState(null)
  const converter = useContext(ConverterContext)
  converter.redraw = setRedraw;
  return <>{Screen}</>
}

/**
 * アプリケーション画面を表示する。
 * @returns アプリケーション画面
 */
const App = () =>
{
  // Bootstrapのモーダルは影の下に隠れてしまう可能性がある(ブラウザごとに挙動が違う)ため、DOM要素の一番上に置くこと。
  //TODO: モーダルハンドラの渡し
  return (
    <ConverterContext.Provider value={new Converter()}>
      <DlgNotePage />
      <Screen/>
    </ConverterContext.Provider>
  )
}

export default App;
