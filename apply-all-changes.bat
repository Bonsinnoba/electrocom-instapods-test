@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  ElectroCom - apply payment/returns/picker changes
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
if not exist "admin-panel" (
    echo ERROR: "admin-panel" folder not found here. Run this script from your repo root.
    pause
    exit /b 1
)
if not exist "storefront" (
    echo ERROR: "storefront" folder not found here. Run this script from your repo root.
    pause
    exit /b 1
)
echo OK - repo root confirmed.

REM ============================================================
REM  Point this at wherever the 3 zips actually downloaded to.
REM  Defaults to your Downloads folder.
REM ============================================================
set ZIP_DIR=%USERPROFILE%\Downloads

if not exist "%ZIP_DIR%\all-changes-api.zip" (
    echo ERROR: Could not find %ZIP_DIR%\all-changes-api.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)

echo.
echo === Step 1: Extracting backend changes into api\ ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\all-changes-api.zip' -DestinationPath 'api' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 2: Extracting admin-panel changes ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\all-changes-admin-panel.zip' -DestinationPath 'admin-panel' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 3: Extracting storefront changes ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\all-changes-storefront.zip' -DestinationPath 'storefront' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 4: Verifying files landed at the right paths ===
set VERIFY_FAIL=0

findstr /C:"maxIdleSeconds" api\security.php >nul 2>&1
if not exist "api\admin_returns.php" (
    echo   MISSING: api\admin_returns.php
    set VERIFY_FAIL=1
)
findstr /C:"ensure_delivered_at_column" api\order_utils.php >nul 2>&1
if errorlevel 1 (
    echo   WARNING: api\order_utils.php doesn't contain expected new code
    set VERIFY_FAIL=1
)
findstr /C:"approveReturn" admin-panel\src\services\api.js >nul 2>&1
if errorlevel 1 (
    echo   WARNING: admin-panel\src\services\api.js doesn't contain expected new code
    set VERIFY_FAIL=1
)
findstr /C:"fetchMyReturns" storefront\src\services\api.js >nul 2>&1
if errorlevel 1 (
    echo   WARNING: storefront\src\services\api.js doesn't contain expected new code
    set VERIFY_FAIL=1
)

if "%VERIFY_FAIL%"=="1" (
    echo.
    echo Some files did not verify correctly - check the warnings above.
    echo You can still continue, but investigate before deploying.
    pause
) else (
    echo   All key files verified OK.
)

echo.
echo === Step 5: Building admin-panel ===
cd admin-panel
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
cd ..

echo.
echo === Step 6: Copying admin-panel build into public\admin ===
xcopy admin-panel\dist\* public\admin\ /E /Y
if errorlevel 1 goto :error

echo.
echo === Step 7: Building storefront ===
cd storefront
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
cd ..

echo.
echo === Step 8: Copying storefront build into public\ ===
xcopy storefront\dist\* public\ /E /Y
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  ALL DONE building and copying.
echo  Next steps (not run automatically - review first):
echo.
echo    git add .
echo    git commit -m "Payment security fixes, returns workflow overhaul, return-eligibility window, picker improvements"
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