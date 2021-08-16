<?php
const Operator = 'alert@test.com';
const DebugMode = true;
const Maintenance = false;
const TimeWaitForAccess = 3;
const MaxJsonDepth = 8;
const JSONPrintOptions = DebugMode ?
        JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_HEX_APOS:
        JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_HEX_APOS;