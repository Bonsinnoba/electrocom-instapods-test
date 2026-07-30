@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  ElectroCom - apply toast-loop fix, homepage-boot retry fix,
REM  and flash-sale-toggle cleanup
REM
REM  Run this from your repo root:
REM  C:\Users\balik\Iven\temp-electrocom-deploy\electrocom-instapods-test
REM ============================================================

echo.
echo === Step 0: Checking you're in the right folder ===
if not exist "storefront" (
    echo ERROR: "storefront" folder not found here. Run this script from your repo root.
    pause
    exit /b 1
)
if not exist "admin-panel" (
    echo ERROR: "admin-panel" folder not found here. Run this script from your repo root.
    pause
    exit /b 1
)
echo OK - repo root confirmed.

set ZIP_DIR=%USERPROFILE%\Downloads

if not exist "%ZIP_DIR%\toast-cache-fix-storefront.zip" (
    echo ERROR: Could not find %ZIP_DIR%\toast-cache-fix-storefront.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)
if not exist "%ZIP_DIR%\flashsale-cleanup-admin-panel.zip" (
    echo ERROR: Could not find %ZIP_DIR%\flashsale-cleanup-admin-panel.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)

echo.
echo === Step 1: Extracting storefront changes (2 files) ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\toast-cache-fix-storefront.zip' -DestinationPath 'storefront' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 2: Extracting admin-panel changes (1 file) ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\flashsale-cleanup-admin-panel.zip' -DestinationPath 'admin-panel' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 3: Verifying files landed correctly ===
set VERIFY_FAIL=0

findstr /C:"useCallback" storefront\src\context\NotificationContext.jsx >nul 2>&1
if errorlevel 1 (echo   WARNING: storefront\src\context\NotificationContext.jsx missing expected code & set VERIFY_FAIL=1)

findstr /C:"maxAttempts" storefront\src\context\SettingsContext.jsx >nul 2>&1
if errorlevel 1 (echo   WARNING: storefront\src\context\SettingsContext.jsx missing expected code & set VERIFY_FAIL=1)

findstr /C:"Hero Slider" admin-panel\src\pages\super-user\GlobalSettings.jsx >nul 2>&1
if errorlevel 1 (echo   WARNING: admin-panel\src\pages\super-user\GlobalSettings.jsx missing expected code & set VERIFY_FAIL=1)

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
echo === Step 6: Building admin-panel ===
cd admin-panel
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
cd ..

echo.
echo === Step 7: Copying admin-panel build into public\admin ===
xcopy admin-panel\dist\* public\admin\ /E /Y
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  ALL DONE building and copying.
echo  Next steps (not run automatically - review first):
echo.
echo    git status
echo    git add .
echo    git commit -m "Fix toast infinite loop, add homepage-boot retry, remove dead flash sale toggle"
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