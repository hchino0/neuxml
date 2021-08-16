<?php
require_once __DIR__.'/Dirs.php';

session_start();
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    $e = new ErrorException($errstr, 0, $errno, $errfile, $errline);
    throw new myex(400, $e->getMessage(), $e->getTrace());
});
try{
    Handle();
}catch(Exception $e){
    RespondError($e);
}
restore_error_handler();

// コマンドハンドラ
function Handle()
{
    $method = strtolower($_SERVER['REQUEST_METHOD']);
    preg_match('|'.dirname($_SERVER['SCRIPT_NAME']).'/([\w%/]*)|', $_SERVER['REQUEST_URI'], $matches);
    $params = explode('/', $matches[1]);
    $kind = strtolower($params[0]);
    $command = $method.':'.$kind;
    if(Maintenance){
        HTTPResponse(503, 'メンテナンス中です', false);
        return;
    }
    if($method === 'options'){
        Preflight();
        return;
    }
    switch ($command) {
        case 'post:process':
            Process();
            return;
    }
    throw new myex(400, 'サポートしていない機能'.$command);
}
