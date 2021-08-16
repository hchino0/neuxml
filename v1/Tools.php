<?php
// エラー報告
class myex extends Exception
{
    public $nichiji;
    public $responseCode;
    public $msg;
    public $trace;
    // msg: メッセージ
    // UID: Userクラスで一括付与するのでthrow時点で設定しなくてよい
    // params: エラーの原因となった/直接関係があるデータの連想配列(必要な場合)
    // bTrace: コンストラクタでトレース情報を取得する場合null
    public function __construct($responseCode, $msg, $trace=null)
    {
        date_default_timezone_set('Asia/Tokyo');
        $this->nichiji = date('Y-m-d H:i:s', time());
        $this->responseCode = $responseCode;
        $this->msg = $msg;
        if($trace === null){
            $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
        }
        $log = array();
        foreach($trace as $item){
            $file = strrchr($item['file'], '\\');
            $log[] = array(substr($file, 1), $item['line'], $item['function']);
        }
        $this->trace = json_encode($log, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    }
}

// プリフライトを処理する
function Preflight()
{
    if(DebugMode){
        header('Access-Control-Allow-Methods: GET,POST,HEAD,OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        HTTPResponse(200, 'CORSテスト', false);
        return;
    }
    throw new myex(400,'別オリジンからのアクセス');
}

// APIレスポンスヘッダを出力する。
function HTTPResponse($code, $body, $bJson)
{
    if(DebugMode){
        header('Access-Control-Allow-Origin: http://192.168.11.3:3000');
        header('Access-Control-Allow-Credentials: true');
    }
    header_remove('X-Powered-By');
    http_response_code($code);
    if($bJson){
        header('Content-Type: application/json; charset=utf-8');
    }else{
        header('Content-Type: text/plain; charset=utf-8');
    }
    echo $body;
}

// エラー時の対応
function RespondError($e)
{
    try{
        if(!($e instanceof myex)){
            // 致命的エラーはハンドラで捕捉できない
            $e = new myex(400, $e->getMessage(), $e->getTrace());
        }
        if(DebugMode){
            $body = json_encode(array('発生日時'=>$e->nichiji, 'メッセージ'=>$e->msg), JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
            HTTPResponse($e->responseCode, $body, true);
            return;
        }
        $code = $e->responseCode;
        // 本番時、503はログが多くなりすぎる可能性があるのでメール通知しない
        if($code === 503){
            HTTPResponse($code, '一時的にサービスを利用できません。時間をおいてから再度アクセスしてください。', false);
            return;
        }
        // サーバ障害・不正アクセス・フロント側バグの疑いがあるため、メール通知する
        MailAlert($e);
        HTTPResponse(400, 'NG', false);
    }catch(Exception $e){}
}

// エラーのメール通知
function MailAlert($error)
{
    $headers = [
        'MIME-Version: 1.0',
        'Content-Transfer-Encoding: base64',
        'Content-Type: text/plain; charset=UTF-8',
        'Return-Path: alert@test.com',
        'From: neuxml <neuxml@test.com>',
        'Sender: neuxml <alert@test.com>',
        'Reply-To: alert@test.com',
        'Organization: neuxml',
        'X-Sender: alert@test.com',
        'X-Priority: 3'
    ];
    $additional_parameters = '-f alert@test.com'; // エンベロープ追加
    $message = [
        "発生日時: {$error->nichiji}",
        "コード: {$error->responseCode}",
        "メッセージ: {$error->msg}",
        "トレース: {$error->trace}"
    ];
    mb_language('Japanese');
    mb_internal_encoding('UTF-8');
    return mb_send_mail(Operator, 'エラー通知', implode("\r\n", $message), implode("\r\n", $headers), $additional_parameters);
}

// Content-Typeがapplication/jsonかどうかをチェックする
function CheckContentTypeJson()
{
    if(!isset($_SERVER['CONTENT_TYPE']) || strtolower($_SERVER['CONTENT_TYPE']) !== 'application/json'){
        throw new myex(400, "不正なAPIアクセス(ContentTypeJSON)");
    }
}

function CheckTimeAccess()
{
    if(!isset($_SESSION['TimeAccess'])){
        $_SESSION['TimeAccess'] = time();
        return;
    }
    $t = $_SESSION['TimeAccess'];
    $now = time();
    if($now < $t + TimeWaitForAccess){
        throw new myex(503,'一時的にサービスを利用できません。時間をおいてから再度アクセスしてください。');
    }
    $_SESSION['TimeAccess'] = $now;
}

function JsonEncode($data)
{
    $json = json_encode($data, JSONPrintOptions, MaxJsonDepth);
    if($json === false){
        throw new myex(500, 'JSONエンコード失敗', $data);
    }
    return $json;
}

function JsonDecode($data)
{
    if(!mb_check_encoding($data, 'UTF-8')){
        throw new myex(400, 'JSON文字コードが不正');
    }
    $json = json_decode($data, true, MaxJsonDepth);
    if($json === null){
        throw new myex(400, 'JSONデコード失敗', '', $data);
    }
    return $json;
}
