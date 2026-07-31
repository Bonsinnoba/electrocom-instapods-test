@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  ElectroCom - REVOKE Institutions/Quotes/Delivery feature
REM  Deletes 25 files (5 admin pages, 8 backend endpoints, 4 shipping
REM  provider files, 10 migration files) and applies 4 edited files
REM  that had references to the removed feature cleaned out.
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
if not exist "admin-panel" (
    echo ERROR: "admin-panel" folder not found here. Run this script from your repo root.
    pause
    exit /b 1
)
echo OK - repo root confirmed.

echo.
echo === Step 1: Deleting the 5 admin-panel pages ===
if exist "admin-panel\src\pages\InstitutionManager.jsx" del "admin-panel\src\pages\InstitutionManager.jsx" & echo   deleted InstitutionManager.jsx
if exist "admin-panel\src\pages\QuoteManager.jsx" del "admin-panel\src\pages\QuoteManager.jsx" & echo   deleted QuoteManager.jsx
if exist "admin-panel\src\pages\RiderManager.jsx" del "admin-panel\src\pages\RiderManager.jsx" & echo   deleted RiderManager.jsx
if exist "admin-panel\src\pages\ShipmentsDashboard.jsx" del "admin-panel\src\pages\ShipmentsDashboard.jsx" & echo   deleted ShipmentsDashboard.jsx
if exist "admin-panel\src\pages\ShippingZoneManager.jsx" del "admin-panel\src\pages\ShippingZoneManager.jsx" & echo   deleted ShippingZoneManager.jsx

echo.
echo === Step 2: Deleting the 8 backend endpoint files ===
if exist "api\admin_institutions.php" del "api\admin_institutions.php" & echo   deleted admin_institutions.php
if exist "api\admin_quote_requests.php" del "api\admin_quote_requests.php" & echo   deleted admin_quote_requests.php
if exist "api\admin_quotes.php" del "api\admin_quotes.php" & echo   deleted admin_quotes.php
if exist "api\admin_riders.php" del "api\admin_riders.php" & echo   deleted admin_riders.php
if exist "api\admin_shipments.php" del "api\admin_shipments.php" & echo   deleted admin_shipments.php
if exist "api\admin_shipping_zones.php" del "api\admin_shipping_zones.php" & echo   deleted admin_shipping_zones.php
if exist "api\quote_request.php" del "api\quote_request.php" & echo   deleted quote_request.php
if exist "api\quote_response.php" del "api\quote_response.php" & echo   deleted quote_response.php

echo.
echo === Step 3: Deleting the shipping provider abstraction folder ===
if exist "api\shipping" rmdir /S /Q "api\shipping" & echo   deleted api\shipping\ (4 files)

echo.
echo === Step 4: Deleting the 10 migration files ===
if exist "api\migrations\038_add_sales_role.sql" del "api\migrations\038_add_sales_role.sql"
if exist "api\migrations\039_create_institutions_tables.sql" del "api\migrations\039_create_institutions_tables.sql"
if exist "api\migrations\040_create_quote_requests_tables.sql" del "api\migrations\040_create_quote_requests_tables.sql"
if exist "api\migrations\041_create_quotes_tables.sql" del "api\migrations\041_create_quotes_tables.sql"
if exist "api\migrations\042_add_institutional_order_columns.sql" del "api\migrations\042_add_institutional_order_columns.sql"
if exist "api\migrations\043_create_shipping_zones_table.sql" del "api\migrations\043_create_shipping_zones_table.sql"
if exist "api\migrations\044_create_riders_table.sql" del "api\migrations\044_create_riders_table.sql"
if exist "api\migrations\045_create_shipments_table.sql" del "api\migrations\045_create_shipments_table.sql"
if exist "api\migrations\046_create_carrier_credentials_table.sql" del "api\migrations\046_create_carrier_credentials_table.sql"
if exist "api\migrations\047_add_delivery_provider_settings.sql" del "api\migrations\047_add_delivery_provider_settings.sql"
echo   deleted 10 migration files

REM ============================================================
REM  Point this at wherever the 2 zips actually downloaded to.
REM ============================================================
set ZIP_DIR=%USERPROFILE%\Downloads

if not exist "%ZIP_DIR%\revoke-institutions-admin-panel.zip" (
    echo ERROR: Could not find %ZIP_DIR%\revoke-institutions-admin-panel.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)
if not exist "%ZIP_DIR%\revoke-institutions-api.zip" (
    echo ERROR: Could not find %ZIP_DIR%\revoke-institutions-api.zip
    echo Edit ZIP_DIR near the top of this script to point at the right folder.
    pause
    exit /b 1
)

echo.
echo === Step 5: Applying the 3 cleaned-up admin-panel files ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\revoke-institutions-admin-panel.zip' -DestinationPath 'admin-panel' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 6: Applying the cleaned-up order_utils.php ===
powershell -command "Expand-Archive -Path '%ZIP_DIR%\revoke-institutions-api.zip' -DestinationPath 'api' -Force"
if errorlevel 1 goto :error

echo.
echo === Step 7: Verifying no references remain ===
set VERIFY_FAIL=0
findstr /C:"InstitutionManager" admin-panel\src\App.jsx >nul 2>&1
if not errorlevel 1 (echo   WARNING: App.jsx still references InstitutionManager & set VERIFY_FAIL=1)
findstr /C:"ensure_institutional_and_delivery_tables" api\order_utils.php >nul 2>&1
if not errorlevel 1 (echo   WARNING: order_utils.php still has the old function & set VERIFY_FAIL=1)

if "%VERIFY_FAIL%"=="1" (
    echo.
    echo Some leftover references were found - check the warnings above.
    pause
) else (
    echo   Clean - no leftover references found.
)

echo.
echo === Step 8: Building admin-panel ===
cd admin-panel
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
cd ..

echo.
echo === Step 9: Copying admin-panel build into public\admin ===
xcopy admin-panel\dist\* public\admin\ /E /Y
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  ALL DONE. Note: the underlying database tables (institutions,
echo  quote_requests, quotes, shipping_zones, riders, shipments,
echo  carrier_credentials, etc.) are NOT dropped by this script -
echo  they're left in place, unused and harmless. Say the word if
echo  you also want a script to drop them.
echo.
echo  Next steps (not run automatically - review first):
echo.
echo    git status
echo    git add -A
echo    git commit -m "Remove institutional quotes and delivery infrastructure feature"
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