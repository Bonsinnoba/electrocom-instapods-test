@echo off
REM ─────────────────────────────────────────────────────────────────
REM deploy_new_features.bat
REM
REM Save this file in your repo ROOT (same folder as "api", "storefront",
REM "admin-panel", "public"). Run it by double-clicking, or from cmd:
REM     deploy_new_features.bat
REM
REM What it does:
REM   1. Moves the migration + PHP files I generated out of your
REM      Downloads folder into their correct spots under api/
REM   2. Builds storefront and copies dist -> public/
REM   3. Builds admin-panel and copies dist -> public/admin/
REM ─────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

set "DOWNLOADS=%USERPROFILE%\Downloads"
set "REPO=%~dp0"
set "MISSING=0"

echo.
echo === Step 1: Moving migration files into api\migrations ===
if not exist "%REPO%api\migrations" mkdir "%REPO%api\migrations"

for %%F in (
    038_add_sales_role.sql
    039_create_institutions_tables.sql
    040_create_quote_requests_tables.sql
    041_create_quotes_tables.sql
    042_add_institutional_order_columns.sql
    043_create_shipping_zones_table.sql
    044_create_riders_table.sql
    045_create_shipments_table.sql
    046_create_carrier_credentials_table.sql
    047_add_delivery_provider_settings.sql
) do (
    if exist "%DOWNLOADS%\%%F" (
        move /Y "%DOWNLOADS%\%%F" "%REPO%api\migrations\%%F" >nul
        echo   moved %%F
    ) else (
        echo   WARNING: %%F not found in %DOWNLOADS% - skipping
        set "MISSING=1"
    )
)

echo.
echo === Step 2: Moving API files ===
if exist "%DOWNLOADS%\admin_institutions.php" (
    move /Y "%DOWNLOADS%\admin_institutions.php" "%REPO%api\admin_institutions.php" >nul
    echo   moved admin_institutions.php
) else (
    echo   WARNING: admin_institutions.php not found in %DOWNLOADS% - skipping
    set "MISSING=1"
)

if not exist "%REPO%api\shipping" mkdir "%REPO%api\shipping"
for %%F in (
    ShippingProviderInterface.php
    SelfFleetProvider.php
    CarrierProviderStub.php
    ShippingProviderFactory.php
) do (
    if exist "%DOWNLOADS%\%%F" (
        move /Y "%DOWNLOADS%\%%F" "%REPO%api\shipping\%%F" >nul
        echo   moved %%F to api\shipping\
    ) else (
        echo   WARNING: %%F not found in %DOWNLOADS% - skipping
        set "MISSING=1"
    )
)

if "%MISSING%"=="1" (
    echo.
    echo   NOTE: Some files were missing from Downloads ^(see WARNINGs above^).
    echo   If your browser auto-renamed a duplicate download ^(e.g. "SelfFleetProvider (1).php"^),
    echo   rename it back to the original filename and re-run this script.
)

echo.
echo === Step 3: Building storefront ===
cd /d "%REPO%storefront"
call npm run build
if errorlevel 1 (
    echo   ERROR: storefront build failed - aborting before copy.
    goto :end
)
cd /d "%REPO%"
xcopy "storefront\dist\*" "public\" /E /Y /I

echo.
echo === Step 4: Building admin-panel ===
cd /d "%REPO%admin-panel"
call npm install
call npm run build
if errorlevel 1 (
    echo   ERROR: admin-panel build failed - aborting before copy.
    goto :end
)
cd /d "%REPO%"
xcopy "admin-panel\dist\*" "public\admin\" /E /Y /I

echo.
echo === Done ===

:end
endlocal
pause