@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  ElectroCom - apply Institutions/Quotes/Delivery fixes
REM  Fixes the missing admin_quote_requests.php + admin_quotes.php,
REM  and adds self-healing for all 10 new tables (institutions,
REM  quotes, shipping zones, riders, shipments, carrier creds, etc)
REM  so they don't silently break like admin_messages/site_settings did.
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
echo OK - repo root confirmed.

set ZIP_DIR=%USERPROFILE%\Downloads

if not exist "%ZIP_DIR%\institutions-quotes-delivery-fix.zip" (
    echo ERROR: Could not find %ZIP_DIR%\institutions-quotes-delivery-fix.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)

echo.
echo === Step 1: Extracting into api\ (10 files: 8 updated, 2 brand new) ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\institutions-quotes-delivery-fix.zip' -DestinationPath 'api' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 2: Verifying files landed correctly ===
set VERIFY_FAIL=0

if not exist "api\admin_quote_requests.php" (echo   MISSING: api\admin_quote_requests.php & set VERIFY_FAIL=1)
if not exist "api\admin_quotes.php" (echo   MISSING: api\admin_quotes.php & set VERIFY_FAIL=1)

findstr /C:"ensure_institutional_and_delivery_tables" api\order_utils.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\order_utils.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"ensure_institutional_and_delivery_tables" api\admin_institutions.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\admin_institutions.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"ensure_institutional_and_delivery_tables" api\admin_riders.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\admin_riders.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"ensure_institutional_and_delivery_tables" api\admin_shipping_zones.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\admin_shipping_zones.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"ensure_institutional_and_delivery_tables" api\admin_shipments.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\admin_shipments.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"ensure_institutional_and_delivery_tables" api\quote_request.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\quote_request.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"ensure_institutional_and_delivery_tables" api\quote_response.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\quote_response.php missing expected code & set VERIFY_FAIL=1)

findstr /C:"activeDeliveryProviderMode" api\brand_settings.php >nul 2>&1
if errorlevel 1 (echo   WARNING: api\brand_settings.php missing expected code & set VERIFY_FAIL=1)

if "%VERIFY_FAIL%"=="1" (
    echo.
    echo Some files did not verify correctly - check the warnings above.
    echo You can still continue, but investigate before deploying.
    pause
) else (
    echo   All key files verified OK.
)

echo.
echo ============================================================
echo  This batch is backend-only (api\ folder) - no frontend
echo  rebuild is needed this time. QuoteManager.jsx and the other
echo  4 institution/delivery admin pages already existed and were
echo  already wired up correctly; only their backend was missing.
echo.
echo  Next steps (not run automatically - review first):
echo.
echo    git status
echo    git add .
echo    git commit -m "Add missing quote admin endpoints, self-heal all institution/quote/delivery tables"
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