$phpCommand = if ($env:PHP_EXE) {
    $env:PHP_EXE
} elseif (Get-Command php -ErrorAction SilentlyContinue) {
    'php'
} else {
    throw 'PHP executable not found. Add php to PATH or set the PHP_EXE environment variable.'
}

& $phpCommand -S localhost:3000 -t public_html
