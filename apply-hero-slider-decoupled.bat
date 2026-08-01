@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  ElectroCom - apply decoupled hero slider fix
REM  New public get_hero_slides.php endpoint + admin_slider.php
REM  cache invalidation + HeroSlider.jsx fetching independently
REM  of the shared homepage_boot bundle.
REM
REM  Run this from your repo root:
REM  C:\Users\balik\Iven\temp-electrocom-deploy\electrocom-instapods-test
REM ============================================================

echo.
echo === Step 0: Checking you're in the right folder ===
if not exist "api" (
    echo ERROR: "api" folder not found here. Run this script from your repo root.
    pause
    exit /b 1
)
if not exist "storefront" (
    echo ERROR: "storefront" folder not found here. Run this script from your repo root.
    pause
    exit /b 1
)
echo OK - repo root confirmed.

set ZIP_DIR=%USERPROFILE%\Downloads

if not exist "%ZIP_DIR%\hero-slider-decoupled-api.zip" (
    echo ERROR: Could not find %ZIP_DIR%\hero-slider-decoupled-api.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)
if not exist "%ZIP_DIR%\hero-slider-decoupled-storefront.zip" (
    echo ERROR: Could not find %ZIP_DIR%\hero-slider-decoupled-storefront.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)

echo.
echo === Step 1: Extracting backend changes into api\ ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\hero-slider-decoupled-api.zip' -DestinationPath 'api' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 2: Extracting storefront changes ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\hero-slider-decoupled-storefront.zip' -DestinationPath 'storefront' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 3: Verifying files landed correctly ===
set VERIFY_FAIL=0

if not exist "api\get_hero_slides.php" (echo   MISSING: api\get_hero_slides.php & set VERIFY_FAIL=1)

findstr /C:"active_hero_slides" api\admin_slider.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\admin_slider.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"fetchHeroSlides" storefront\src\services\api.js >nul 2>&1
if errorlevel 1 (echo   WARNING: storefront\src\services\api.js missing expected code & set VERIFY_FAIL=1)

findstr /C:"fetchHeroSlides" storefront\src\components\HeroSlider.jsx >nul 2>&1
if errorlevel 1 (echo   WARNING: storefront\src\components\HeroSlider.jsx missing expected code & set VERIFY_FAIL=1)

if "%VERIFY_FAIL%"=="1" (
    echo.
    echo Some files did not verify correctly - check the warnings above.
    echo You can still continue, but investigate before deploying.
    pause
) else (
    echo   All key files verified OK.
)

echo.
echo === Step 4: Building storefront ===
cd storefront
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
cd ..

echo.
echo === Step 5: Copying storefront build into public\ ===
xcopy storefront\dist\* public\ /E /Y
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  ALL DONE building and copying. No admin-panel changes this
echo  time - only api\ (backend) and storefront\ (frontend).
echo.
echo  Next steps (not run automatically - review first):
echo.
echo    git status
echo    git add .
echo    git commit -m "Decouple hero slider from shared homepage_boot bundle - dedicated endpoint + retry"
echo    git push
echo.
echo  Then trigger your InstaPods deploy.
echo ============================================================
pause
exit /b 0

:error
echo.
echo *** Something failed above - scroll up to see the error. ***
pause
exit /b 1