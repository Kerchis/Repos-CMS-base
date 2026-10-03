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
require_once $base . '/core/style/BoxStyles.php';
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

// El espacio de un bloque ya no es un campo suyo: lo lleva el mismo
// control que el de cualquier otra cosa. Lo que si tiene que pasar es que
// una pagina guardada con los campos viejos siga igual de separada.
echo "\nEl espacio viejo del bloque se traduce al sistema nuevo\n";
$viejo = \Meridian\Security\Sanitizer::node(
	[ 'id' => 'v1', 'type' => 'menu-list', 'props' => [ 'padTop' => 40, 'padBottom' => 0 ], 'styles' => [] ],
	0
);
foreach (
	[
		[ 'padding-top', '40px' ],
		[ 'padding-bottom', '0px' ],
	] as [ $prop, $esperado ]
) {
	$val = $viejo['styles']['desktop'][ $prop ] ?? '«no existe»';
	if ( $esperado === $val ) {
		++$ok;
		echo "  OK    padTop/padBottom → styles.desktop.$prop = $esperado\n";
	} else {
		++$fallos;
		echo "  FALLA styles.desktop.$prop llega como " . var_export( $val, true ) . "\n";
	}
}
if ( ! isset( $viejo['props']['padTop'] ) && ! isset( $viejo['props']['padBottom'] ) ) {
	++$ok;
	echo "  OK    y los campos viejos ya no existen en props\n";
} else {
	++$fallos;
	echo "  FALLA props sigue llevando padTop/padBottom\n";
}
$vacio = \Meridian\Security\Sanitizer::node(
	[ 'id' => 'v2', 'type' => 'menu-list', 'props' => [], 'styles' => [] ],
	0
);
if ( ! isset( $vacio['styles']['desktop']['padding-top'] ) ) {
	++$ok;
	echo "  OK    sin valores viejos no se inventa ningun relleno\n";
} else {
	++$fallos;
	echo "  FALLA aparece un relleno de la nada\n";
}

// El fondo de la seccion vivia en `props.background` con un valor por
// defecto. Ese defecto no se migra (no lo eligio nadie); un color de
// verdad si.
echo "\nEl fondo viejo de la seccion se traduce, y el defecto no\n";
$conColor = \Meridian\Security\Sanitizer::node(
	[ 'id' => 'v3', 'type' => 'section', 'props' => [ 'background' => [ 'mode' => 'custom', 'value' => '#D94E27' ] ], 'styles' => [] ],
	0
);
$bg = $conColor['styles']['desktop']['background-color'] ?? '«no existe»';
if ( '#d94e27' === $bg ) {
	++$ok;
	echo "  OK    props.background → styles.desktop.background-color = $bg\n";
} else {
	++$fallos;
	echo "  FALLA el color viejo llega como " . var_export( $bg, true ) . "\n";
}
$porDefecto = \Meridian\Security\Sanitizer::node(
	[ 'id' => 'v4', 'type' => 'section', 'props' => [ 'background' => [ 'mode' => 'token', 'token' => 'color.background' ] ], 'styles' => [] ],
	0
);
if ( ! isset( $porDefecto['styles']['desktop']['background-color'] ) ) {
	++$ok;
	echo "  OK    el fondo por defecto no se copia a mano en cada seccion\n";
} else {
	++$fallos;
	echo "  FALLA todas las secciones nacen con un color escrito\n";
}

// Atajo de cuatro lados guardado por la version anterior.
echo "\nLos atajos viejos se despliegan en propiedades largas\n";
$atajo = \Meridian\Security\Sanitizer::node(
	[ 'id' => 'v5', 'type' => 'section', 'props' => [], 'styles' => [ 'desktop' => [ 'padding' => '10px 20px 30px 40px', 'margin' => '5px' ] ] ],
	0
);
foreach (
	[
		[ 'padding-top', '10px' ],
		[ 'padding-right', '20px' ],
		[ 'padding-bottom', '30px' ],
		[ 'padding-left', '40px' ],
		[ 'margin-top', '5px' ],
		[ 'margin-left', '5px' ],
	] as [ $prop, $esperado ]
) {
	$val = $atajo['styles']['desktop'][ $prop ] ?? '«no existe»';
	if ( $esperado === $val ) {
		++$ok;
		echo "  OK    $prop = $esperado\n";
	} else {
		++$fallos;
		echo "  FALLA $prop llega como " . var_export( $val, true ) . "\n";
	}
}
if ( ! isset( $atajo['styles']['desktop']['padding'] ) && ! isset( $atajo['styles']['desktop']['margin'] ) ) {
	++$ok;
	echo "  OK    y el atajo desaparece: no hay dos valores para lo mismo\n";
} else {
	++$fallos;
	echo "  FALLA el atajo sigue ahi, compitiendo con las propiedades largas\n";
}

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
			'background-color' => '#D94E27',
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
		[ 'desktop', 'background-color', '#d94e27' ],
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

// Lo nuevo de «Avanzado»: posicion, transformacion y atributos. Son los
// tres sitios donde el usuario escribe texto libre que acaba en la web,
// asi que lo que importa no es solo que se guarde: es que lo que no
// esta permitido no se guarde.
echo "\nAvanzado: posicion, transformacion y atributos\n";
$av  = \Meridian\Security\Sanitizer::node(
	[
		'id'     => 'nAv',
		'type'   => 'heading',
		'props'  => [ 'text' => 'Hola' ],
		'styles' => [
			'desktop' => [
				'position'         => 'relative',
				'top'              => '12px',
				'z-index'          => '5',
				'transform'        => 'rotate(-3deg) scale(1.05)',
				'transform-origin' => 'top left',
			],
		],
		'attrs'  => [
			'data-gtm'   => 'cta-principal',
			'aria-label' => 'Reserva tu mesa',
			'title'      => 'Reservar',
			'onclick'    => 'alert(1)',
			'style'      => 'color:red',
			'href'       => 'javascript:alert(1)',
			'data-x'     => 'javascript:alert(1)',
		],
	],
	0
);
$avSt = $av['styles']['desktop'] ?? [];
foreach (
	[
		[ 'position', 'relative' ],
		[ 'top', '12px' ],
		[ 'z-index', '5' ],
		[ 'transform', 'rotate(-3deg) scale(1.05)' ],
		[ 'transform-origin', 'top left' ],
	] as [ $prop, $esperado ]
) {
	$val = $avSt[ $prop ] ?? '«no existe»';
	if ( $esperado === $val ) {
		++$ok;
		echo "  OK    estilo $prop = $esperado\n";
	} else {
		++$fallos;
		echo "  FALLA estilo $prop llega como " . var_export( $val, true ) . "\n";
	}
}
// Una transformacion con `url(` no es una transformacion.
$mala = \Meridian\Security\Sanitizer::node(
	[ 'id' => 'nMal', 'type' => 'heading', 'styles' => [ 'desktop' => [ 'transform' => 'url(javascript:alert(1))', 'position' => 'cualquiera' ] ] ],
	0
);
foreach ( [ 'transform', 'position' ] as $prop ) {
	if ( ! isset( $mala['styles']['desktop'][ $prop ] ) ) {
		++$ok;
		echo "  OK    estilo $prop con basura no se guarda\n";
	} else {
		++$fallos;
		echo "  FALLA estilo $prop guarda " . var_export( $mala['styles']['desktop'][ $prop ], true ) . "\n";
	}
}
$attrs = $av['attrs'] ?? [];
foreach (
	[
		[ 'data-gtm', 'cta-principal' ],
		[ 'aria-label', 'Reserva tu mesa' ],
		[ 'title', 'Reservar' ],
	] as [ $k, $esperado ]
) {
	$val = $attrs[ $k ] ?? '«no existe»';
	if ( $esperado === $val ) {
		++$ok;
		echo "  OK    atributo $k = $esperado\n";
	} else {
		++$fallos;
		echo "  FALLA atributo $k llega como " . var_export( $val, true ) . "\n";
	}
}
foreach ( [ 'onclick', 'style', 'href', 'data-x' ] as $k ) {
	if ( ! isset( $attrs[ $k ] ) ) {
		++$ok;
		echo "  OK    atributo $k rechazado\n";
	} else {
		++$fallos;
		echo "  FALLA atributo $k se ha colado con " . var_export( $attrs[ $k ], true ) . "\n";
	}
}

echo "\n" . ( $fallos ? "HAY $fallos FALLOS" : 'TODO SOBREVIVE AL GUARDADO (' . $ok . ' comprobaciones)' ) . "\n";
exit( $fallos ? 1 : 0 );
