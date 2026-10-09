<?php
/**
 * Derivar paletas: de cinco colores a un tema de panel y a una paleta de web.
 * ---------------------------------------------------------------------------
 *
 * Las paletas llegan como lo que son: una rampa de cinco tonos del más
 * oscuro al más claro. Un tema del CMS necesita diecisiete colores y una
 * paleta de web diecinueve, así que hay que derivarlos. Hacerlo a ojo es
 * la manera segura de colar un texto gris claro sobre fondo crema que no
 * se lee, de modo que aquí cada color se calcula y, sobre todo, **se
 * comprueba**: si una pareja no llega al contraste que exige la norma, el
 * color se oscurece o se aclara a pasos hasta que llega.
 *
 * Qué hace al ejecutarse:
 *   1. Escribe `krg-cms/presets/<slug>.json`, una por paleta.
 *   2. Escupe por pantalla el bloque PHP de `Skin::temas()` para pegarlo.
 *   3. Si alguna pareja no cumple, no escribe nada y lo dice.
 *
 * No se ejecuta en producción: es la herramienta con la que se hicieron
 * los ficheros, y queda aquí para poder repetir el cálculo o añadir otra
 * paleta sin inventarse los valores.
 *
 * Uso:  .tools/php/php tools/derivar-paletas.php [--escribir]
 */

/* ===================================================================
   Las seis rampas, tal como llegaron
   =================================================================== */

$PALETAS = [
	'amatista' => [
		'nombre' => 'Amatista',
		'nota'   => 'Morado profundo que se abre en lilas muy claros.',
		'rampa'  => [ '#49225b', '#6e3482', '#a56abd', '#e7dbef', '#f5ebfa' ],
	],
	'cacao'    => [
		'nombre' => 'Cacao',
		'nota'   => 'Tierra tostada: chocolate, arena y lino.',
		'rampa'  => [ '#291c0e', '#6e473b', '#a78d78', '#beb5a9', '#e1d4c2' ],
	],
	'malva'    => [
		'nombre' => 'Malva',
		'nota'   => 'Rosa empolvado sobre tierra, de los suaves.',
		'rampa'  => [ '#423736', '#987185', '#d6aa9f', '#e9d5b7', '#f4e2d1' ],
	],
	'caramelo' => [
		'nombre' => 'Caramelo',
		'nota'   => 'Cálido y dulce: ámbar, miel y nata.',
		'rampa'  => [ '#3e2522', '#8c6e63', '#d3a376', '#ffe0b2', '#fff2df' ],
	],
	'pinar'    => [
		'nombre' => 'Pinar',
		'nota'   => 'Verde de bosque cerrado con hoja clara.',
		'rampa'  => [ '#0f2a1d', '#375534', '#6b9071', '#aec3b0', '#e3eed4' ],
	],
	'noche'    => [
		'nombre' => 'Noche',
		'nota'   => 'Azul de medianoche con grises fríos.',
		'rampa'  => [ '#1a2d42', '#2e4156', '#aab7b7', '#c0c8ca', '#d4d8dd' ],
	],
];

/* ===================================================================
   Color: lo mínimo para mezclar y para medir
   =================================================================== */

function rgb( string $hex ): array {
	$hex = ltrim( trim( $hex ), '#' );
	return [ hexdec( substr( $hex, 0, 2 ) ), hexdec( substr( $hex, 2, 2 ) ), hexdec( substr( $hex, 4, 2 ) ) ];
}

function hex( array $rgb ): string {
	return sprintf( '#%02x%02x%02x', ...array_map( static fn( $v ) => (int) max( 0, min( 255, round( $v ) ) ), $rgb ) );
}

/** Luminancia relativa de sRGB, la de la norma. */
function luz( string $hexcolor ): float {
	$l = [];
	foreach ( rgb( $hexcolor ) as $c ) {
		$c    = $c / 255;
		$l[]  = $c <= 0.03928 ? $c / 12.92 : pow( ( $c + 0.055 ) / 1.055, 2.4 );
	}
	return 0.2126 * $l[0] + 0.7152 * $l[1] + 0.0722 * $l[2];
}

/** Contraste entre dos colores, de 1 a 21. */
function contraste( string $a, string $b ): float {
	$x = luz( $a );
	$y = luz( $b );
	return ( max( $x, $y ) + 0.05 ) / ( min( $x, $y ) + 0.05 );
}

/** Mezcla de dos colores: $t = 0 devuelve $a, $t = 1 devuelve $b. */
function mezcla( string $a, string $b, float $t ): string {
	$x = rgb( $a );
	$y = rgb( $b );
	return hex( [
		$x[0] + ( $y[0] - $x[0] ) * $t,
		$x[1] + ( $y[1] - $x[1] ) * $t,
		$x[2] + ( $y[2] - $x[2] ) * $t,
	] );
}

function oscurecer( string $c, float $t ): string {
	return mezcla( $c, '#000000', $t );
}

function aclarar( string $c, float $t ): string {
	return mezcla( $c, '#ffffff', $t );
}

/**
 * Empuja un color hasta que contrasta lo suficiente contra otro.
 *
 * Se mueve de cuatro en cuatro centésimas hacia el negro o hacia el
 * blanco —lo que haga falta— y se para en cuanto llega al mínimo. Así un
 * morado medio acaba siendo un morado oscuro si tiene que llevar texto
 * blanco encima, en vez de quedarse en un botón ilegible.
 */
function hasta_contraste( string $color, string $contra, float $min, string $hacia = 'auto' ): string {
	if ( contraste( $color, $contra ) >= $min ) {
		return $color;
	}
	if ( 'auto' === $hacia ) {
		$hacia = luz( $contra ) > 0.45 ? 'oscuro' : 'claro';
	}
	$destino = 'oscuro' === $hacia ? '#000000' : '#ffffff';
	for ( $t = 0.04; $t <= 1.0; $t += 0.04 ) {
		$cand = mezcla( $color, $destino, $t );
		if ( contraste( $cand, $contra ) >= $min ) {
			return $cand;
		}
	}
	return $destino;
}

/** El mismo empujón, pero contra dos fondos a la vez. */
function hasta_contraste2( string $color, string $a, string $b, float $min ): string {
	$c = hasta_contraste( $color, $a, $min );
	return hasta_contraste( $c, $b, $min );
}

/* ===================================================================
   De cinco colores al tema del panel (diecisiete claves)
   ===================================================================
   El panel es claro con la barra lateral oscura, igual en todos los
   temas: lo que cambia es el tinte. El tono más oscuro de la rampa manda
   en la barra y en el texto; el más claro, en el papel.
   =================================================================== */

function tema_del_panel( array $rampa ): array {
	[ $c1, $c2, $c3, $c4, $c5 ] = $rampa;

	// Los papeles. El más claro de la rampa, aclarado por pasos: la
	// tarjeta casi blanca, el papel con algo de tinte y la superficie
	// un punto por debajo para que se distinga del papel.
	$card        = aclarar( $c5, 0.86 );
	$surfaceSoft = aclarar( $c5, 0.58 );
	$paper       = aclarar( $c5, 0.34 );
	$surface     = aclarar( $c5, 0.12 );

	// El texto: el tono más oscuro, casi negro, pero con su tinte.
	$ink = hasta_contraste2( oscurecer( $c1, 0.35 ), $paper, $card, 10.0 );

	// La barra lateral tiene que aguantar texto casi blanco encima.
	$sidebar     = hasta_contraste( $c1, $card, 4.5, 'oscuro' );
	$sidebarDeep = oscurecer( $sidebar, 0.38 );

	// El botón lleva texto blanco puro: ese es el que manda.
	$action     = hasta_contraste( $c2, '#ffffff', 4.6, 'oscuro' );
	$action     = hasta_contraste( $action, $paper, 3.0, 'oscuro' );
	$actionDeep = hasta_contraste( oscurecer( $action, 0.22 ), '#ffffff', 4.6, 'oscuro' );

	// El realce es un fondo con texto oscuro encima: tiene que ser claro.
	$accent     = hasta_contraste( aclarar( $c3, 0.25 ), $ink, 4.6, 'claro' );
	$accentSoft = hasta_contraste( aclarar( $c4, 0.45 ), $ink, 4.6, 'claro' );

	// Las líneas: la suave casi no se ve, la marcada separa campos.
	$line       = aclarar( $c4, 0.35 );
	$lineStrong = hasta_contraste( aclarar( $c3, 0.18 ), $card, 1.6, 'oscuro' );

	// El texto secundario se lee sobre papel y sobre tarjeta.
	$muted = hasta_contraste2( oscurecer( $c2, 0.12 ), $paper, $card, 4.5 );

	// Correcto, aviso y peligro no son de marca: son señales, y las
	// mismas en todo el panel. Se tiñen un pelo con la paleta para que
	// no canten, y se oscurecen hasta que se leen sobre el papel.
	$ok     = hasta_contraste( mezcla( '#3f6b4a', $c1, 0.12 ), $paper, 4.5, 'oscuro' );
	$warn   = hasta_contraste( mezcla( '#8a5a10', $c1, 0.12 ), $paper, 4.5, 'oscuro' );
	$danger = hasta_contraste( mezcla( '#a33a2a', $c1, 0.10 ), $paper, 4.5, 'oscuro' );

	return [
		'sidebar'     => $sidebar,
		'sidebarDeep' => $sidebarDeep,
		'action'      => $action,
		'actionDeep'  => $actionDeep,
		'accent'      => $accent,
		'accentSoft'  => $accentSoft,
		'paper'       => $paper,
		'surface'     => $surface,
		'surfaceSoft' => $surfaceSoft,
		'card'        => $card,
		'line'        => $line,
		'lineStrong'  => $lineStrong,
		'ink'         => $ink,
		'muted'       => $muted,
		'ok'          => $ok,
		'warn'        => $warn,
		'danger'      => $danger,
	];
}

/* ===================================================================
   De cinco colores a la paleta de la web (diecinueve tokens)
   =================================================================== */

function paleta_de_la_web( array $rampa ): array {
	[ $c1, $c2, $c3, $c4, $c5 ] = $rampa;

	$background = aclarar( $c5, 0.10 );
	$surface    = $c4;
	$surfaceAlt = aclarar( $c5, 0.62 );

	// El texto del sitio va a AAA sobre el fondo: es el que más se lee.
	$text = hasta_contraste2( oscurecer( $c1, 0.25 ), $background, $surface, 7.0 );

	// El primario es el color de los botones y de los titulares de
	// acento: lleva texto claro encima, así que se mide contra él.
	$claro     = aclarar( $c5, 0.55 );
	$primary   = hasta_contraste( $c2, $claro, 4.6, 'oscuro' );
	$secondary = hasta_contraste( $c1, $claro, 4.6, 'oscuro' );
	$tertiary  = $c3;

	$textSecondary = hasta_contraste2( oscurecer( $c2, 0.10 ), $background, $surface, 4.5 );
	$muted         = hasta_contraste2( oscurecer( $c3, 0.22 ), $background, $surface, 4.5 );

	$border       = $c4;
	$borderStrong = hasta_contraste( oscurecer( $c3, 0.15 ), $background, 2.0, 'oscuro' );

	$success = hasta_contraste( mezcla( '#2f6b4a', $c1, 0.10 ), $background, 4.5, 'oscuro' );
	$warning = hasta_contraste( mezcla( '#8a5a10', $c1, 0.10 ), $background, 4.5, 'oscuro' );
	$error   = hasta_contraste( mezcla( '#9a3327', $c1, 0.08 ), $background, 4.5, 'oscuro' );

	return [
		'primary'        => [ $primary, 'Primario' ],
		'secondary'      => [ $secondary, 'Secundario' ],
		'tertiary'       => [ $tertiary, 'Terciario' ],
		'background'     => [ $background, 'Fondo' ],
		'surface'        => [ $surface, 'Superficie' ],
		'surface-alt'    => [ $surfaceAlt, 'Superficie clara' ],
		'text'           => [ $text, 'Texto' ],
		'text-secondary' => [ $textSecondary, 'Texto secundario' ],
		'muted'          => [ $muted, 'Texto atenuado' ],
		'border'         => [ $border, 'Borde' ],
		'border-strong'  => [ $borderStrong, 'Borde fuerte' ],
		'success'        => [ $success, 'Éxito' ],
		'warning'        => [ $warning, 'Advertencia' ],
		'error'          => [ $error, 'Error' ],
		'info'           => [ $primary, 'Informativo' ],
		'highlight'      => [ $surfaceAlt, 'Destacado' ],
		'on-primary'     => [ hasta_contraste( $claro, $primary, 4.6, 'claro' ), 'Texto sobre primario' ],
		'on-secondary'   => [ hasta_contraste( $claro, $secondary, 4.6, 'claro' ), 'Texto sobre secundario' ],
		'on-surface'     => [ hasta_contraste( $text, $surface, 4.6, 'oscuro' ), 'Texto sobre superficie' ],
	];
}

/* ===================================================================
   Las comprobaciones: las mismas parejas que vigila el banco
   =================================================================== */

$fallos = [];

function exige( string $quien, string $que, float $v, float $min ): void {
	global $fallos;
	$bien = $v >= $min;
	printf( "  %s %-46s %5.2f:1  (mínimo %.1f)\n", $bien ? 'ok  ' : 'MAL ', $que, $v, $min );
	if ( ! $bien ) {
		$fallos[] = "$quien · $que";
	}
}

$PARES_PANEL = [
	[ 'el texto sobre el fondo', 'ink', 'paper', 4.5 ],
	[ 'el texto sobre las tarjetas', 'ink', 'card', 4.5 ],
	[ 'el texto secundario sobre el fondo', 'muted', 'paper', 4.5 ],
	[ 'el texto secundario sobre las tarjetas', 'muted', 'card', 4.5 ],
	[ 'la barra lateral', 'card', 'sidebar', 4.5 ],
	[ 'el realce', 'ink', 'accent', 4.5 ],
	[ 'el tinte suave', 'ink', 'accentSoft', 4.5 ],
	[ 'el verde de correcto', 'ok', 'paper', 4.5 ],
	[ 'el ámbar de aviso', 'warn', 'paper', 4.5 ],
	[ 'el rojo de peligro', 'danger', 'paper', 4.5 ],
	[ 'el borde del campo', 'lineStrong', 'card', 1.4 ],
	[ 'el botón contra el fondo', 'action', 'paper', 3.0 ],
];

$PARES_WEB = [
	[ 'el texto sobre el fondo', 'text', 'background', 7.0 ],
	[ 'el texto sobre la superficie', 'on-surface', 'surface', 4.5 ],
	[ 'el texto secundario sobre el fondo', 'text-secondary', 'background', 4.5 ],
	[ 'el atenuado sobre el fondo', 'muted', 'background', 4.5 ],
	[ 'el texto del botón', 'on-primary', 'primary', 4.5 ],
	[ 'el texto sobre el secundario', 'on-secondary', 'secondary', 4.5 ],
	[ 'el error sobre el fondo', 'error', 'background', 4.5 ],
	[ 'el borde marcado sobre el fondo', 'border-strong', 'background', 1.8 ],
];

/* ===================================================================
   A trabajar
   =================================================================== */

$escribir = in_array( '--escribir', $argv, true );
$raiz     = dirname( __DIR__ );
$base     = json_decode( (string) file_get_contents( $raiz . '/krg-cms/presets/honeycomb.json' ), true );

$bloque = '';
foreach ( $PALETAS as $slug => $p ) {
	echo "\n=== {$p['nombre']} ({$slug}) ===\n";

	$tema = tema_del_panel( $p['rampa'] );
	echo "-- el panel\n";
	foreach ( $PARES_PANEL as [$que, $a, $b, $min] ) {
		exige( $slug, $que, contraste( $tema[ $a ], $tema[ $b ] ), $min );
	}
	exige( $slug, 'el texto blanco del botón', contraste( '#ffffff', $tema['action'] ), 4.5 );
	exige( $slug, 'el texto blanco del botón al pasar', contraste( '#ffffff', $tema['actionDeep'] ), 4.5 );

	$web = paleta_de_la_web( $p['rampa'] );
	echo "-- la web\n";
	foreach ( $PARES_WEB as [$que, $a, $b, $min] ) {
		exige( $slug, $que, contraste( $web[ $a ][0], $web[ $b ][0] ), $min );
	}

	// El bloque PHP para `Skin::temas()`.
	$bloque .= "\t\t\t'{$slug}' => [\n";
	$bloque .= "\t\t\t\t'nombre'  => __( '{$p['nombre']}', 'meridian' ),\n";
	$bloque .= "\t\t\t\t'nota'    => __( '{$p['nota']}', 'meridian' ),\n";
	$bloque .= "\t\t\t\t'colores' => [\n";
	foreach ( $tema as $k => $v ) {
		$bloque .= sprintf( "\t\t\t\t\t%-13s => '%s',\n", "'$k'", $v );
	}
	$bloque .= "\t\t\t\t],\n\t\t\t],\n";

	// La paleta de la web, con el resto de tokens de la casa.
	$json          = $base;
	$json['slug']  = $slug;
	$json['name']  = $p['nombre'];
	$json['description'] = $p['nota'];
	$json['tokens']['color'] = [];
	foreach ( $web as $k => [$valor, $etiqueta] ) {
		$json['tokens']['color'][ $k ] = [
			'value' => strtoupper( $valor ),
			'type'  => 'color',
			'label' => $etiqueta,
		];
	}
	// Las sombras se tiñen del tono oscuro de la paleta: una sombra gris
	// sobre un fondo cálido se ve sucia.
	[ $r, $g, $b ] = rgb( $p['rampa'][0] );
	$json['tokens']['shadow'] = [
		'sm' => [ 'value' => "0 1px 2px rgba($r,$g,$b,0.06)" ],
		'md' => [ 'value' => "0 10px 30px rgba($r,$g,$b,0.10)" ],
		'lg' => [ 'value' => "0 24px 60px rgba($r,$g,$b,0.16)" ],
	];

	if ( $escribir && ! $fallos ) {
		file_put_contents(
			$raiz . "/krg-cms/presets/{$slug}.json",
			json_encode( $json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n"
		);
		echo "   escrito presets/{$slug}.json\n";
	}
}

echo "\n";
if ( $fallos ) {
	echo 'HAY ' . count( $fallos ) . " PAREJAS QUE NO LLEGAN:\n  - " . implode( "\n  - ", $fallos ) . "\n";
	exit( 1 );
}
echo "Todas las parejas llegan al mínimo.\n";
if ( ! $escribir ) {
	echo "(prueba en seco: vuelve a lanzarlo con --escribir para generar los JSON)\n";
}

echo "\n--- para pegar en Skin::temas() ---\n\n" . $bloque;
