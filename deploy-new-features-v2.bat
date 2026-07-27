@echo off
REM ─────────────────────────────────────────────────────────────────
REM deploy_new_features.bat  (v2 - covers quotes + delivery infra)
REM
REM Save in your repo ROOT (same folder as "api", "storefront",
REM "admin-panel", "public"). Run by double-clicking or from cmd.
REM
REM What it does:
REM   1. Moves migration files into api\migrations
REM   2. Moves new API files into api\ and api\shipping\
REM   3. OVERWRITES admin-panel\src\App.jsx, Sidebar.jsx, api.js with
REM      versions that include the new routes/functions - see warning below
REM   4. Moves new admin-panel page files into admin-panel\src\pages
REM   5. Builds storefront -> public\
REM   6. Builds admin-panel -> public\admin\
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
    ) else if exist "%REPO%api\migrations\%%F" (
        echo   already in place: %%F
    ) else (
        echo   WARNING: %%F not found in Downloads or api\migrations - skipping
        set "MISSING=1"
    )
)

echo.
echo === Step 2: Moving new API files into api\ ===
for %%F in (
    admin_institutions.php
    admin_quote_requests.php
    admin_quotes.php
    admin_shipping_zones.php
    admin_riders.php
    admin_shipments.php
    quote_request.php
    quote_response.php
) do (
    if exist "%DOWNLOADS%\%%F" (
        move /Y "%DOWNLOADS%\%%F" "%REPO%api\%%F" >nul
        echo   moved %%F
    ) else if exist "%REPO%api\%%F" (
        echo   already in place: %%F
    ) else (
        echo   WARNING: %%F not found in Downloads or api\ - skipping
        set "MISSING=1"
    )
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
    ) else if exist "%REPO%api\shipping\%%F" (
        echo   already in place: api\shipping\%%F
    ) else (
        echo   WARNING: %%F not found in Downloads or api\shipping\ - skipping
        set "MISSING=1"
    )
)

echo.
echo === Step 3: Overwriting App.jsx, Sidebar.jsx, api.js ===
echo   NOTE: these three REPLACE existing files with versions that add the
echo   new routes/nav items/API functions. If you've made your own edits to
echo   these three files since the repo was last shared with Claude, back
echo   them up first - this will overwrite those edits.
echo.
if exist "%DOWNLOADS%\App.jsx" (
    move /Y "%DOWNLOADS%\App.jsx" "%REPO%admin-panel\src\App.jsx" >nul
    echo   overwrote admin-panel\src\App.jsx
) else (
    echo   WARNING: App.jsx not found in Downloads - skipping ^(routes for new pages won't exist^)
    set "MISSING=1"
)
if exist "%DOWNLOADS%\Sidebar.jsx" (
    move /Y "%DOWNLOADS%\Sidebar.jsx" "%REPO%admin-panel\src\components\Sidebar.jsx" >nul
    echo   overwrote admin-panel\src\components\Sidebar.jsx
) else (
    echo   WARNING: Sidebar.jsx not found in Downloads - skipping ^(nav links for new pages won't show^)
    set "MISSING=1"
)
if exist "%DOWNLOADS%\api.js" (
    move /Y "%DOWNLOADS%\api.js" "%REPO%admin-panel\src\services\api.js" >nul
    echo   overwrote admin-panel\src\services\api.js
) else (
    echo   WARNING: api.js not found in Downloads - skipping ^(new pages can't call the backend^)
    set "MISSING=1"
)

echo.
echo === Step 4: Moving new admin-panel pages ===
if not exist "%REPO%admin-panel\src\pages" mkdir "%REPO%admin-panel\src\pages"
for %%F in (
    InstitutionManager.jsx
    QuoteManager.jsx
    ShippingZoneManager.jsx
    RiderManager.jsx
    ShipmentsDashboard.jsx
) do (
    if exist "%DOWNLOADS%\%%F" (
        move /Y "%DOWNLOADS%\%%F" "%REPO%admin-panel\src\pages\%%F" >nul
        echo   moved %%F
    ) else if exist "%REPO%admin-panel\src\pages\%%F" (
        echo   already in place: %%F
    ) else (
        echo   WARNING: %%F not found in Downloads or admin-panel\src\pages\ - skipping
        set "MISSING=1"
    )
)

if "%MISSING%"=="1" (
    echo.
    echo   NOTE: Some files were missing ^(see WARNINGs above^). If a browser
    echo   auto-renamed a duplicate download ^(e.g. "App (1).jsx"^), rename it
    echo   back to the original filename and re-run this script.
)

echo.
echo === Step 5: Building storefront ===
cd /d "%REPO%storefront"
call npm run build
if errorlevel 1 (
    echo   ERROR: storefront build failed - aborting before copy.
    goto :end
)
cd /d "%REPO%"
xcopy "storefront\dist\*" "public\" /E /Y /I

echo.
echo === Step 6: Building admin-panel ===
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