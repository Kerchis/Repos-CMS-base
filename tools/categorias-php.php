<?php
/**
 * El lado PHP del interruptor «mostrar las categorias en la web».
 *
 * Pinta el modulo de categorias por el camino de verdad (registro →
 * renderizador) en los tres contextos que importan —web publica,
 * «Preview» y lienzo— con el interruptor encendido y apagado, y de paso
 * comprueba que el ajuste se guarda y se vuelve a leer.
 *
 * Imprime un JSON que lee `tools/prueba-categorias.mjs`.
 *
 *   .tools/php/php tools/categorias-php.php
 *
 * @package Meridian
 */

define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
foreach (
	[
		'/core/render/RenderContext.php',
		'/core/design/Contrast.php',
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/security/UrlValidator.php',
		'/core/content/BlogSettings.php',
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
		'/core/render/ComponentRenders.php',
		'/core/render/BrandRenders.php',
		'/core/render/NodeRenderer.php',
		'/core/security/Sanitizer.php',
		'/core/style/Breakpoints.php',
		'/core/style/BoxStyles.php',
		'/core/style/DocumentCssCompiler.php',
	] as $f
) {
	require_once $base . $f;
}

\Meridian\Components\Registry::boot();

// Dos categorias con entradas, como en una instalacion de verdad.
$GLOBALS['krg_categorias'] = [
	(object) [
		'term_id' => 3,
		'name'    => 'Recetas',
		'slug'    => 'recetas',
		'count'   => 4,
	],
	(object) [
		'term_id' => 5,
		'name'    => 'Historias',
		'slug'    => 'historias',
		'count'   => 2,
	],
];

$nodo = [
	'id'       => 'cat1',
	'type'     => 'categories',
	'props'    => [],
	'styles'   => [],
	'children' => [],
];

/** Pinta el modulo en el contexto pedido. */
$pinta = static function ( bool $canvas ) use ( $nodo ): string {
	$ctx            = new \Meridian\Render\RenderContext();
	$ctx->isCanvas  = $canvas;
	$ctx->isPreview = $canvas;
	return \Meridian\Render\ComponentRenders::categories( $nodo, [], '', $ctx );
};

$salida = [];

// 1. Sin haber tocado nunca el interruptor: las categorias se ven.
$salida['porDefecto'] = \Meridian\Content\BlogSettings::get();
$salida['encendido']  = [
	'publico' => $pinta( false ),
	'lienzo'  => $pinta( true ),
];

// 2. Apagado.
\Meridian\Content\BlogSettings::save( [ 'showCategories' => false ] );
$salida['trasApagar'] = \Meridian\Content\BlogSettings::get();
$salida['apagado']    = [
	'publico' => $pinta( false ),
	'lienzo'  => $pinta( true ),
];

// 3. Y encendido otra vez: el ajuste tiene que ir y volver.
\Meridian\Content\BlogSettings::save( [ 'showCategories' => true ] );
$salida['trasEncender'] = \Meridian\Content\BlogSettings::get();
$salida['reencendido']  = [ 'publico' => $pinta( false ) ];

// 4. Lo que queda guardado en la opcion, tal cual.
\Meridian\Content\BlogSettings::save( [ 'showCategories' => false ] );
$salida['opcionCruda'] = get_option( MERIDIAN_OPTION_BLOG, null );

echo wp_json_encode( $salida );
