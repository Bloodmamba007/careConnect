param (
    [Parameter(Mandatory=$true)]
    [string]$ImagePath
)

try {
    Add-Type -AssemblyName System.Drawing
    [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
    
    $fullPath = [System.IO.Path]::GetFullPath($ImagePath)
    if (-not (Test-Path $fullPath)) {
        Write-Output '{"text": "", "lines": []}'
        exit 0
    }

    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) {
        Write-Output '{"text": "", "lines": []}'
        exit 0
    }

    $fileStream = [System.IO.File]::OpenRead($fullPath)
    $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fileStream)
    $decoder = ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)).GetAwaiter().GetResult()
    $sBmp = ($decoder.GetSoftwareBitmapAsync()).GetAwaiter().GetResult()
    $ocrResult = ($engine.RecognizeAsync($sBmp)).GetAwaiter().GetResult()
    $fileStream.Close()

    $lineTexts = @()
    foreach ($line in $ocrResult.Lines) {
        $lineTexts += $line.Text
    }

    $outObj = @{
        text = $ocrResult.Text
        lines = $lineTexts
    }
    $outObj | ConvertTo-Json -Compress
} catch {
    Write-Output '{"text": "", "lines": []}'
}
