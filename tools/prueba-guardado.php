<?php
/**
 * Banco de pruebas del camino de guardado.
 *
 * Por que: el lienzo del constructor no es un render puro del servidor —
 * `paintLiveCss()` le vuelve a pintar clases y estilos desde el documento
 * que vive en el navegador. Asi que una propiedad que el servidor tira al
 * guardar se sigue viendo bien en el lienzo y solo se nota al abrir la
 * pestana «Preview». Este banco pasa un nodo por el mismo saneador que usa
 * la API y dice que propiedades sobreviven.
 *
 *   .tools/php/php tools/prueba-guardado.php
 */

define( 'ABSPATH', __DIR__ . '/' );

require __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/components/Catalog.php';
require_once $base . '/core/components/BrandCatalog.php';
require_once $base . '/core/components/Registry.php';
require_once $base . '/core/security/Sanitizer.php';
require_once $base . '/core/security/UrlValidator.php';
require_once $base . '/core/design/TokenCompiler.php';

\Meridian\Components\Registry::boot();

$fallos = 0;
$ok     = 0;

/** Comprueba que una propiedad sobrevive al guardado con el valor esperado. */
function revisa( string $tipo, array $props, array $esperado ): void {
	global $fallos, $ok;
	$nodo = [
		'id'       => 'n1',
		'type'     => $tipo,
		'props'    => $props,
		'children' => [],
	];
	$out = \Meridian\Security\Sanitizer::node( $nodo, 0 );
	foreach ( $esperado as $clave => $valor ) {
		$real = $out['props'][ $clave ] ?? '«no existe»';
		if ( $real === $valor ) {
			++$ok;
			printf( "  OK    %-14s %-18s %s\n", $tipo, $clave, var_export( $real, true ) );
		} else {
			++$fallos;
			printf( "  FALLA %-14s %-18s esperaba %s y llega %s\n", $tipo, $clave, var_export( $valor, true ), var_export( $real, true ) );
		}
	}
}

echo "Propiedades de seccion\n";
revisa(
	'section',
	[
		'width'          => 'full',
		'minHeight'      => 'screen',
		'minHeightValue' => 90,
		'minHeightUnit'  => 'vh',
		'heightMode'     => 'min',
		'vAlign'         => 'center',
		'curtain'        => 'on',
		'headerSkin'     => 'light',
		'htmlId'         => 'cta',
	],
	[
		'width'          => 'full',
		'minHeight'      => 'screen',
		'minHeightValue' => 90,
		'minHeightUnit'  => 'vh',
		'heightMode'     => 'min',
		'vAlign'         => 'center',
		'curtain'        => 'on',
		'headerSkin'     => 'light',
	]
);

echo "\nPropiedades de fila y columna\n";
revisa( 'row', [ 'gap' => 32, 'vAlign' => 'center' ], [ 'gap' => 32, 'vAlign' => 'center' ] );
revisa( 'column', [ 'span' => 6, 'spanTablet' => 12, 'spanMobile' => 12, 'contentVAlign' => 'center' ], [ 'span' => 6, 'contentVAlign' => 'center' ] );

echo "\nAlto a medida en porcentaje\n";
revisa(
	'section',
	[ 'minHeight' => 'custom', 'minHeightValue' => 45, 'minHeightUnit' => 'vh', 'heightMode' => 'exact' ],
	[ 'minHeight' => 'custom', 'minHeightValue' => 45, 'minHeightUnit' => 'vh', 'heightMode' => 'exact' ]
);

echo "\nModulos nuevos\n";
revisa( 'menu-list', [ 'groupMode' => 'stacked', 'imageShape' => 'circle', 'imageSize' => 120 ], [ 'groupMode' => 'stacked', 'imageShape' => 'circle', 'imageSize' => 120 ] );
revisa( 'footer-split', [ 'mediaSide' => 'right', 'ratio' => 'copy-wide', 'height' => 'custom', 'heightValue' => 520, 'heightUnit' => 'px' ], [ 'mediaSide' => 'right', 'ratio' => 'copy-wide', 'height' => 'custom', 'heightValue' => 520, 'heightUnit' => 'px' ] );

echo "\nEstilos por nodo (los que compila DocumentCssCompiler)\n";
$nodo = [
	'id'     => 'n2',
	'type'   => 'section',
	'props'  => [],
	'styles' => [ 'desktop' => [ 'min-height' => '90vh', 'padding-top' => '0px' ] ],
];
$out = \Meridian\Security\Sanitizer::node( $nodo, 0 );
$mh  = $out['styles']['desktop']['min-height'] ?? '«no existe»';
if ( '90vh' === $mh ) {
	++$ok;
	echo "  OK    styles.desktop.min-height = 90vh\n";
} else {
	++$fallos;
	echo "  FALLA styles.desktop.min-height llega como " . var_export( $mh, true ) . "\n";
}

echo "\n" . ( $fallos ? "HAY $fallos FALLOS" : 'TODO SOBREVIVE AL GUARDADO (' . $ok . ' comprobaciones)' ) . "\n";
exit( $fallos ? 1 : 0 );
