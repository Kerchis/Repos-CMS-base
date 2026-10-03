<?php
/**
 * Vuelca el catalogo de componentes como JSON.
 *
 * Lo usa tools/prueba-panel.mjs para alimentar al constructor con el mismo
 * registro que recibe en el admin, sin WordPress delante.
 *
 *   .tools/php/php tools/dump-registry.php > /tmp/registry.json
 */

define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
foreach (
	[
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/security/UrlValidator.php',
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
	] as $f
) {
	require_once $base . $f;
}

\Meridian\Components\Registry::boot();
echo wp_json_encode( array_values( \Meridian\Components\Registry::all() ) );
