Add-Type -AssemblyName System.Drawing

function New-EduMagIcon {
  param(
    [Parameter(Mandatory = $true)][int]$Size,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [switch]$Maskable
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $navy = [System.Drawing.ColorTranslator]::FromHtml('#0A1628')
  $gold = [System.Drawing.ColorTranslator]::FromHtml('#F5A623')
  $graphics.Clear($navy)

  $scale = $Size / 512.0
  $circleRadius = $(if ($Maskable) { 142 } else { 166 }) * $scale
  $center = 256 * $scale
  $goldBrush = [System.Drawing.SolidBrush]::new($gold)
  $navyBrush = [System.Drawing.SolidBrush]::new($navy)
  $graphics.FillEllipse($goldBrush, $center - $circleRadius, $center - $circleRadius, 2 * $circleRadius, 2 * $circleRadius)

  if ($Maskable) {
    $cap = @(@(132,224), @(256,160), @(380,224), @(256,288))
    $body = @(@(180,256), @(256,295), @(332,256), @(332,328), @(300,348), @(256,356), @(212,348), @(180,328))
    $tasselX, $tasselTop, $tasselBottom = 373, 231, 309
  } else {
    $cap = @(@(108,218), @(256,142), @(404,218), @(256,294))
    $body = @(@(166,256), @(256,302), @(346,256), @(346,342), @(308,366), @(256,374), @(204,366), @(166,342))
    $tasselX, $tasselTop, $tasselBottom = 396, 226, 318
  }

  $capPoints = $cap | ForEach-Object { [System.Drawing.PointF]::new($_[0] * $scale, $_[1] * $scale) }
  $bodyPoints = $body | ForEach-Object { [System.Drawing.PointF]::new($_[0] * $scale, $_[1] * $scale) }
  $graphics.FillPolygon($navyBrush, [System.Drawing.PointF[]]$capPoints)
  $graphics.FillPolygon($navyBrush, [System.Drawing.PointF[]]$bodyPoints)

  $penWidth = $(if ($Maskable) { 16 } else { 18 }) * $scale
  $pen = [System.Drawing.Pen]::new($navy, $penWidth)
  $pen.StartCap = $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($pen, $tasselX * $scale, $tasselTop * $scale, $tasselX * $scale, $tasselBottom * $scale)
  $dotRadius = $(if ($Maskable) { 14 } else { 16 }) * $scale
  $graphics.FillEllipse($navyBrush, ($tasselX * $scale) - $dotRadius, (($tasselBottom + 20) * $scale) - $dotRadius, 2 * $dotRadius, 2 * $dotRadius)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $navyBrush.Dispose()
  $goldBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$iconsDirectory = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Path $iconsDirectory -Force | Out-Null
New-EduMagIcon -Size 192 -OutputPath (Join-Path $iconsDirectory 'icon-192.png')
New-EduMagIcon -Size 512 -OutputPath (Join-Path $iconsDirectory 'icon-512.png')
New-EduMagIcon -Size 512 -OutputPath (Join-Path $iconsDirectory 'icon-maskable-512.png') -Maskable
