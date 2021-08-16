<?php
function Process()
{
    CheckTimeAccess();
    CheckContentTypeJson();
    $json = file_get_contents('php://input');
    $data = JsonDecode($json);
    $json = CreateXML($data);
    HTTPResponse(200, $json, true);
}

class Tempo
{
    public $at;
    public $tempo;
    public function __construct($at, $tempo)
    {
        $this->at = $at;
        $this->tempo = $tempo;
    }
}

class Element
{
    public $at;
    public $len;
    public $nn;
    public $text;
    public $bBreath;
    public $bRest;
    public $bTieStart;
    public $bTieStop;
    public $tempoList;
    public function __construct($at, $len, $note, $bRest, $bTieStart=false, $bTieStop=false)
    {
        $this->at = $at;
        $this->len = $len;
        $this->nn = $note['nn'];
        $this->text = $note['text'];
        $this->bBreath = $note['breath'];
        $this->bRest = $bRest;
        $this->bTieStart = $bTieStart;
        $this->bTieStop = $bTieStop;
        $this->tempoList = array();
    }
    // コピーコンストラクト用
    public function GetData()
    {
        return ['nn'=>$this->nn, 'text'=>$this->text, 'breath'=>$this->bBreath];
    }
}

class Measure
{
    public $elements;
    public function __construct()
    {
        $this->elements = array();
    }
}

function CreateXML($data)
{
    $resolution = $data['resolution'];
    $transpose = $data['transpose'];
    $tempo = $data['tempo']['events'];
    $notes = $data['notes']['events'];
    // エラーチェック
    if(count($notes) === 0){
        throw new myex(400, "ノートデータがありません。");
    }
    if(count($tempo) === 0){
        throw new myex(400, "テンポデータがありません。");
    }
    // 音の重なり除去
    for($i=0; $i < count($notes)-1; $i++){
        $end = $notes[$i]['at'] + $notes[$i]['len'];
        if($notes[$i+1]['at'] < $end){
            $notes[$i]['len'] -= $end - $notes[$i+1]['at'];
        }
    }
    // 休符を含んだデータを作成する
    $elements = array();
    $elements[] = new Element($notes[0]['at'], $notes[0]['len'], $notes[0], false);
    for($i=1; $i < count($notes); $i++){
        $end = $notes[$i-1]['at'] + $notes[$i-1]['len'];
        if($end < $notes[$i]['at']){
            // 休符
            $elements[] = new Element($notes[$i-1]['at'] + $notes[$i-1]['len'], $notes[$i]['at'] - $end, ['nn'=>0, 'text'=>'', 'breath'=>false], true);
        }
        $elements[] = new Element($notes[$i]['at'], $notes[$i]['len'], $notes[$i], false);
    }
    // 最初の休符を削除
    if($elements[0]->at !== 0){
        $diff = $elements[0]->at;
        for($i=0; $i < count($tempo); $i++){
            $tempo[$i]['at'] -= $diff;
        }
        for($i=0; $i < count($elements); $i++){
            $elements[$i]->at -= $diff;
        }
    }
    // 無効な歌詞を持つ音を休符にする
    for($i=0; $i < count($elements); $i++){
        if(trim($elements[$i]->text) === '' || trim($elements[$i]->text) === '-'){
            $elements[$i]->bRest = true;
        }
    }
    // 最初の音より前のテンポチェンジをスキップ
    $j = 0;
    for(;$j < count($tempo) && $tempo[$j]['at'] <= 0; $j++){
    }
    if($j === 0){
        // データエラー。開始部分のテンポが未確定。[0]が開始部分のテンポであると仮定する。
        $j = 1;
    }
    // テンポ変更の割り振り・各区分の最初は前区分の最後を引き継ぐ
    for($i=0; $i < count($elements); $i++){
        $elements[$i]->tempoList[] = new Tempo($elements[$i]->at, $tempo[$j-1]['tempo']);
        $end = $elements[$i]->at + $elements[$i]->len;
        for(; $j < count($tempo); $j++){
            if($end < $tempo[$j]['at']){
                break;
            }
            if($end == $tempo[$j]['at']){
                $j++;
                break;
            }
            $elements[$i]->tempoList[] = new Tempo($tempo[$j]['at'], $tempo[$j]['tempo']);
        }        
    }
    // 各区分の長さを計算する。また各種数値を解像度依存の値から正規化した値(浮動小数)に変更。これ以降atの値は使用しない。
    for($i=0; $i < count($elements); $i++){
        $e = $elements[$i];
        $at = $e->tempoList[0]->at;
        $len = 0;
        $j = 1;
        for(; $j < count($e->tempoList); $j++){
            $len += ($e->tempoList[$j]->at - $e->tempoList[$j-1]->at) / $resolution * ($e->tempoList[$j-1]->tempo) / 500000.0;
            $at = $e->tempoList[$j]->at;
        }
        $end = $e->at + $e->len;
        if($at < $end){
            $len += ($end - $at) / $resolution * ($e->tempoList[$j-1]->tempo) / 500000.0;
        }
        $e->len = $len;
    }
    // 4.0拍ごとに振り分ける
    $measures = array();
    $measures[] = new Measure();
    $j = 0;
    $totallen = 0;
    for($i=0; $i < count($elements); $i++){
        $len = $elements[$i]->len;
        $bTie = !($elements[$i]->bRest);// 休符はタイにしない
        if(4.0 < $totallen + $len){
            // 次小節開始またはタイ発生
            $bTieing = false;// タイが発生しているか
            // タイ開始部
            if($totallen < 4.0){
                $bTieing = true;
                $measures[$j]->elements[] = new Element(0, 4.0 - $totallen, $elements[$i]->GetData(), $elements[$i]->bRest, $bTie);
                $len -= 4.0 - $totallen;
            }
            // タイ中継部
            while(4.0 < $len){
                $bTieing = true;
                $measures[] = new Measure();
                $j++;
                $measures[$j]->elements[] = new Element(0, 4.0, $elements[$i]->GetData(), $elements[$i]->bRest, $bTie, $bTie);
                $len -= 4.0;
            }
            // タイ終結部
            if(0 < $len){
                $measures[] = new Measure();
                $j++;
                $measures[$j]->elements[] = new Element(0, $len, $elements[$i]->GetData(), $elements[$i]->bRest, false, $bTieing && $bTie);
                $totallen = $len;
            }else{
                // 小節終結部でちょうどタイが終わった
                $last = count($measures[$j]->elements)-1;
                $measures[$j]->elements[$last]->bTieStart = false;
                $measures[$j]->elements[$last]->bTieStop = $bTie;
                $totallen = 0;
            }
        }else{
            $measures[$j]->elements[] = new Element(0, $len, $elements[$i]->GetData(), $elements[$i]->bRest);
            $totallen += $len;
        }
    }
    // 最終小節末尾の休符を追加
    if($totallen < 4.0){
        $measures[$j]->elements[] = new Element(0, 4.0 - $totallen, ['nn'=>0, 'text'=> "", 'breath'=>false], true);
    }
    // 解像度480に変更
    for($i=0; $i < count($measures); $i++){
        for($j=0; $j < count($measures[$i]->elements); $j++){
            $measures[$i]->elements[$j]->len = (int)(floor($measures[$i]->elements[$j]->len * 480.0 + 0.5) + 0.1); // 四捨五入
        }
    }
    // 改めて誤差調整
    for($i=0; $i < count($measures); $i++){
        $len = 0;
        for($j=0; $j < count($measures[$i]->elements); $j++){
            $len += $measures[$i]->elements[$j]->len;
        }
        $diff = (480 * 4) - $len;
        $nNotes = count($measures[$i]->elements);
        if(0 < $diff){
            // 足りない
            $rem = $diff % $nNotes;
            for($j=0; $j < $nNotes; $j++){
                $measures[$i]->elements[$j]->len += (int)(floor($diff / $nNotes) + 0.1);
            }
            for($j=0; $j < $rem; $j++){
                $measures[$i]->elements[$j]->len += 1;
            }
        }else if($diff < 0){
            // 多い
            $diff *= -1;
            $rem = $diff % $nNotes;
            for($j=0; $j < $nNotes; $j++){
                $measures[$i]->elements[$j]->len -= (int)(floor($diff / $nNotes) + 0.1);
            }
            for($j=0; $j < $rem; $j++){
                $measures[$i]->elements[$j]->len -= 1;
            }
        }
    }
    // len<==0チェック。最も長いイベントから調整分を引く。
    for($i=0; $i < count($measures); $i++){
        $iTarget = 0;
        $val = 0;
        for($j=0; $j < count($measures[$i]->elements); $j++){
            $e = $measures[$i]->elements[$j];
            if($measures[$i]->elements[$iTarget]->len < $e->len){
                $iTarget = $j;
            }
            if(0 < $e->len){
                continue;
            }
            $val += (-($e->len)) + 1;
            $e->len = 1;
        }
        $measures[$i]->elements[$iTarget]->len -= $val;
    }
    // MusicXML書き出し
    $str = '<?xml version="1.0" encoding="UTF-8"?><score-partwise><part><measure number="1"><attributes><divisions>480</divisions><time><beats>4</beats><beat-type>4</beat-type></time><sound tempo="120"/></attributes><note><rest/><duration>1920</duration></note></measure>';
    for($i=0; $i < count($measures); $i++){
        $str .= '<measure number="' . ($i+2) . '">';
        for($j=0; $j < count($measures[$i]->elements); $j++){
            $e = $measures[$i]->elements[$j];
            $str .= '<note>';
            if($e->bRest){
                $str .= '<rest/>';
            }else{
                $str .= nnToPitch($e->nn + $transpose);
            }
            $str .= '<duration>' . $e->len . '</duration>';
            if($e->bTieStop){
                $str .= '<tie type="stop"/>';
            }
            if($e->bTieStart){
                $str .= '<tie type="start"/>';
            }
            if($e->bBreath){
                $str .= '<notations><articulations><breath-mark/></articulations></notations>';
            }
            if($e->bRest !== true && $e->bTieStop !== true && $e->text !== ""){
                $str .= '<lyric number="1"><syllabic>single</syllabic><text>' . $e->text . '</text></lyric>';
            }
            $str .= '</note>';
        }
        $str .= '</measure>';
    }
    $str .= '<measure number="' . (count($measures)+2) . '"><note><rest/><duration>1920</duration></note></measure></part></score-partwise>';
    return JsonEncode(array('data' => $str));
}

function nnToPitch($nn)
{
    $oct = (int)floor($nn / 12);
    $step = $nn % 12;
    $notename = [
        '<step>C</step>',
        '<step>C</step><alter>1</alter>',
        '<step>D</step>',
        '<step>D</step><alter>1</alter>',
        '<step>E</step>',
        '<step>F</step>',
        '<step>F</step><alter>1</alter>',
        '<step>G</step>',
        '<step>G</step><alter>1</alter>',
        '<step>A</step>',
        '<step>A</step><alter>1</alter>',
        '<step>B</step>'
    ];
    return '<pitch>' . $notename[$step] . '<octave>' . ($oct - 1) . '</octave></pitch>';
}
