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
require_once $base . '/core/content/Document.php';

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

echo "\nColores propios del bloque (mandan sobre el «Tema»)\n";
revisa(
	'statement-cta',
	[
		'theme'     => 'forest',
		'bgColor'   => [ 'mode' => 'custom', 'value' => '#D94E27' ],
		'textColor' => [ 'mode' => 'custom', 'value' => 'var(--color-background)' ],
	],
	[
		'theme'     => 'forest',
		'bgColor'   => [ 'mode' => 'custom', 'token' => '', 'value' => '#D94E27' ],
		// Un token del sistema tiene que sobrevivir: antes se tiraba.
		'textColor' => [ 'mode' => 'custom', 'token' => '', 'value' => 'var(--color-background)' ],
	]
);
revisa(
	'statement-cta',
	[ 'theme' => 'forest' ],
	// Sin color elegido no se inventa ninguno: manda el tema.
	[ 'bgColor' => [ 'mode' => 'none', 'token' => '', 'value' => '' ] ]
);
revisa(
	'menu-list',
	[
		'titleColor' => [ 'mode' => 'custom', 'value' => '#FFD166' ],
		'priceColor' => [ 'mode' => 'custom', 'value' => '#073B4C' ],
	],
	[
		'titleColor' => [ 'mode' => 'custom', 'token' => '', 'value' => '#FFD166' ],
		'priceColor' => [ 'mode' => 'custom', 'token' => '', 'value' => '#073B4C' ],
	]
);

echo "\nEspacio del bloque: en blanco no es cero\n";
revisa( 'menu-list', [ 'padTop' => 40, 'padBottom' => 0 ], [ 'padTop' => 40, 'padBottom' => 0 ] );
revisa( 'menu-list', [], [ 'padTop' => '', 'padBottom' => '' ] );
revisa( 'review-slider', [ 'padTop' => 24 ], [ 'padTop' => 24 ] );
revisa( 'statement-cta', [ 'padBottom' => 90 ], [ 'padBottom' => 90 ] );

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

// El viaje completo de un estilo del panel: saneado, a JSON para la meta
// del post y de vuelta. Es el tramo donde «lo guardo y al recargar esta
// vacio» seria invisible desde fuera.
echo "\nRelleno, margen y fondo de una seccion, ida y vuelta\n";
$sec = [
	'id'     => 'secX',
	'type'   => 'section',
	'props'  => [ 'width' => 'full' ],
	'styles' => [
		'desktop' => [
			'padding-top'    => '50px',
			'padding-left'   => '80px',
			'margin-bottom'  => '30px',
			'background'     => '#D94E27',
		],
		'tablet'  => [ 'padding-top' => '20px' ],
	],
];
$doc   = \Meridian\Security\Sanitizer::document( [ 'sections' => [ $sec ] ] );
$ida   = wp_json_encode( $doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
$vuelta = \Meridian\Content\Document::decode( wp_slash( $ida ) );
$st     = $vuelta['sections'][0]['styles'] ?? [];
foreach (
	[
		[ 'desktop', 'padding-top', '50px' ],
		[ 'desktop', 'padding-left', '80px' ],
		[ 'desktop', 'margin-bottom', '30px' ],
		[ 'desktop', 'background', '#D94E27' ],
		[ 'tablet', 'padding-top', '20px' ],
	] as [ $bp, $prop, $esperado ]
) {
	$val = $st[ $bp ][ $prop ] ?? '«no existe»';
	if ( $esperado === $val ) {
		++$ok;
		echo "  OK    $bp.$prop = $esperado\n";
	} else {
		++$fallos;
		echo "  FALLA $bp.$prop llega como " . var_export( $val, true ) . "\n";
	}
}

echo "\n" . ( $fallos ? "HAY $fallos FALLOS" : 'TODO SOBREVIVE AL GUARDADO (' . $ok . ' comprobaciones)' ) . "\n";
exit( $fallos ? 1 : 0 );
