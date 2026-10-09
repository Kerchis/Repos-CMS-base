<?php
/**
 * El texto con formato, la tipografía del menú y la cuarta familia.
 *
 * Tres encargos que comparten el mismo riesgo: que el panel enseñe una
 * cosa y la web otra. Aquí se recorre el camino de verdad —saneador del
 * guardado → renderizador → CSS— y se comprueba que:
 *
 *   1. Un texto con negrita, cursiva o enlace sobrevive al guardado y
 *      sale como formato en la web, no como «<strong>» escrito.
 *   2. Lo que no es formato de línea (un script, un iframe, un
 *      «onclick») se cae, también si alguien lo escribe a mano en la
 *      pestaña HTML.
 *   3. Un titular con formato no se parte letra a letra (romperíamos
 *      las etiquetas) y uno sin formato se sigue partiendo igual que
 *      antes: nada cambia para quien no use el editor.
 *   4. La tipografía del menú de la cabecera se guarda y acaba en el
 *      CSS de la cabecera; sin elegir nada no se escribe ni una regla.
 *   5. La cuarta familia («Texto general») sale como `--font-ui` y la
 *      consumen los textos de interfaz, con los títulos de respaldo.
 *
 *   .tools/php/php tools/prueba-prosa.php
 */

define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
foreach (
	[
		'/core/render/RenderContext.php',
		'/core/design/Contrast.php',
		'/core/design/PresetStore.php',
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/design/FontCatalog.php',
		'/core/security/UrlValidator.php',
		'/core/security/Sanitizer.php',
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
		'/core/media/Images.php',
		'/core/media/Formats.php',
		'/core/forms/Booking.php',
		'/core/forms/BookingStore.php',
		'/core/render/ComponentRenders.php',
		'/core/render/BrandRenders.php',
		'/core/render/NodeRenderer.php',
		'/core/style/Breakpoints.php',
		'/core/style/BoxStyles.php',
		'/core/style/DocumentCssCompiler.php',
		'/core/cache/DocumentCache.php',
		'/core/navigation/Menus.php',
		'/core/style/Chrome.php',
	] as $f
) {
	require_once $base . $f;
}

\Meridian\Components\Registry::boot();

use Meridian\Design\TokenCompiler;
use Meridian\Navigation\Menus;
use Meridian\Render\ComponentRenders;
use Meridian\Render\RenderContext;
use Meridian\Security\Sanitizer;
use Meridian\Style\Chrome;

$fallos = 0;
$ok     = 0;

function comprueba( bool $cond, string $msg ): void {
	global $fallos, $ok;
	if ( $cond ) {
		++$ok;
		echo "  OK    $msg\n";
	} else {
		++$fallos;
		echo "  FALLA $msg\n";
	}
}

/** Pinta un nodo por el camino de verdad: saneado del guardado y render. */
function pinta( string $tipo, array $props ): string {
	$nodo = Sanitizer::node(
		[
			'id'    => 'n1',
			'type'  => $tipo,
			'props' => $props,
		],
		0
	);
	$ctx = new RenderContext();
	return \Meridian\Render\NodeRenderer::render( $nodo, $ctx );
}

echo "\nPRUEBA 1 — el formato de línea sobrevive al guardado\n";

$con_formato = 'Miel <strong>cruda</strong> y <em>sin filtrar</em> de <a href="https://ejemplo.com">la sierra</a>';
$guardado    = Sanitizer::field( $con_formato, [ 'type' => 'textarea' ] );
comprueba( str_contains( $guardado, '<strong>cruda</strong>' ), 'la negrita se guarda' );
comprueba( str_contains( $guardado, '<em>sin filtrar</em>' ), 'la cursiva se guarda' );
comprueba( str_contains( $guardado, 'href="https://ejemplo.com"' ), 'el enlace se guarda con su dirección' );

echo "\nPRUEBA 2 — lo que no es formato de línea se cae\n";

$sucio = 'Hola <script>alert(1)</script><iframe src="x"></iframe>'
	. '<span onclick="robar()">pincha</span><h2>Titular</h2><a href="javascript:alert(1)">no</a>';
$limpio = Sanitizer::field( $sucio, [ 'type' => 'textarea' ] );
comprueba( ! str_contains( $limpio, '<script' ), 'el script se cae' );
comprueba( ! str_contains( $limpio, '<iframe' ), 'el iframe se cae' );
comprueba( ! str_contains( $limpio, 'onclick' ), 'el «onclick» se cae' );
comprueba( ! str_contains( $limpio, '<h2' ), 'un encabezado no cabe dentro de un párrafo: se cae' );
comprueba( ! str_contains( $limpio, 'javascript:' ), 'el enlace con «javascript:» se desinfecta' );
comprueba( str_contains( $limpio, 'Hola' ) && str_contains( $limpio, 'pincha' ), 'y el texto se queda' );

echo "\nPRUEBA 3 — el párrafo lo pinta como formato, no como letras\n";

$html = pinta( 'paragraph', [ 'text' => $con_formato ] );
comprueba( str_contains( $html, '<strong>cruda</strong>' ), 'el párrafo saca la negrita de verdad' );
comprueba( ! str_contains( $html, '&lt;strong&gt;' ), 'y no enseña la etiqueta escrita' );

$salto = pinta( 'paragraph', [ 'text' => "Primera\nSegunda" ] );
comprueba( str_contains( $salto, '<br' ), 'un salto de línea manual sigue siendo un salto' );

$amp = pinta( 'paragraph', [ 'text' => 'Pan & miel' ] );
comprueba( str_contains( $amp, 'Pan &amp; miel' ) && ! str_contains( $amp, '&amp;amp;' ), 'la «&» sale una sola vez, sin doble escape' );

echo "\nPRUEBA 4 — el titular grande\n";

$t_simple = pinta( 'brand-hero', [ 'title' => 'MIEL' ] );
comprueba( str_contains( $t_simple, 'm-ch' ), 'sin formato el titular se sigue partiendo letra a letra' );
comprueba( str_contains( $t_simple, 'data-reveal="letters"' ), 'y conserva su animación' );

$t_rico = pinta( 'brand-hero', [ 'title' => 'MIEL <em>cruda</em>' ] );
comprueba( str_contains( $t_rico, '<em>cruda</em>' ), 'con formato el titular lo respeta' );
comprueba( ! str_contains( $t_rico, 'm-ch' ), 'y entonces no se parte letra a letra: rompería las etiquetas' );
comprueba( str_contains( $t_rico, 'data-reveal="fade"' ), 'la animación pasa a fundido, que sí puede con una línea entera' );

$t_br = pinta( 'brand-hero', [ 'title' => 'MIEL<br>de la sierra' ] );
comprueba( substr_count( $t_br, 'm-line' ) >= 2, 'el <br> del editor parte el titular en dos líneas' );

echo "\nPRUEBA 5 — los demás campos de prosa\n";

$casos = [
	[ 'heading', [ 'text' => 'Un <strong>titular</strong>' ], '<strong>titular</strong>' ],
	[ 'quote', [ 'text' => 'Una <em>cita</em>' ], '<em>cita</em>' ],
	[ 'card', [ 'title' => 'T', 'text' => 'Texto <strong>fuerte</strong>' ], '<strong>fuerte</strong>' ],
	[ 'feature', [ 'text' => 'Texto <em>suave</em>' ], '<em>suave</em>' ],
	[ 'hero', [ 'title' => 'Hola <strong>tú</strong>' ], '<strong>tú</strong>' ],
	[ 'cta', [ 'title' => 'T', 'subtitle' => 'Sub <em>rayado</em>' ], '<em>rayado</em>' ],
	[ 'accordion', [ 'items' => [ [ 'q' => 'P', 'a' => 'R <strong>icha</strong>' ] ] ], '<strong>icha</strong>' ],
	[ 'tabs', [ 'items' => [ [ 'q' => 'P', 'a' => 'R <strong>icha</strong>' ] ] ], '<strong>icha</strong>' ],
	[ 'timeline', [ 'items' => [ [ 'q' => 'P', 'a' => 'R <em>icha</em>' ] ] ], '<em>icha</em>' ],
	[ 'testimonials', [ 'items' => [ [ 'text' => 'Muy <strong>bueno</strong>' ] ] ], '<strong>bueno</strong>' ],
	[ 'feature-grid', [ 'items' => [ [ 'title' => 'T', 'text' => 'Algo <em>más</em>' ] ] ], '<em>más</em>' ],
	[ 'statement-cta', [ 'title' => 'T', 'text' => 'Algo <strong>más</strong>' ], '<strong>más</strong>' ],
	[ 'trace-module', [ 'title' => 'T', 'steps' => [ [ 'title' => 'P', 'text' => 'Paso <em>uno</em>' ] ] ], '<em>uno</em>' ],
	[ 'numbered-list', [ 'items' => [ [ 'title' => 'T', 'text' => 'Punto <strong>uno</strong>' ] ] ], '<strong>uno</strong>' ],
	[ 'statement-list', [ 'items' => [ [ 'title' => 'Hito <em>uno</em>' ] ] ], '<em>uno</em>' ],
	[ 'review-slider', [ 'items' => [ [ 'text' => 'Reseña <strong>buena</strong>' ] ] ], '<strong>buena</strong>' ],
	[ 'info-table', [ 'rows' => [ [ 'a' => 'A', 'b' => 'B' ] ], 'caption' => 'Pie <em>de tabla</em>' ], '<em>de tabla</em>' ],
	[ 'menu-list', [ 'items' => [ [ 'title' => 'Plato', 'text' => 'Con <strong>miel</strong>' ] ] ], '<strong>miel</strong>' ],
	[ 'contact-form', [ 'consent' => 'Acepto la <a href="/privacidad/">política</a>' ], '<a href="/privacidad/"' ],
	[ 'scroll-text', [ 'text' => 'Texto <strong>revelado</strong>' ], '<strong>revelado</strong>' ],
	[ 'split-panel', [ 'title' => 'T', 'subtitle' => 'Sub <em>título</em>' ], '<em>título</em>' ],
	[ 'collection-grid', [ 'items' => [ [ 'title' => 'T', 'text' => 'Con <em>nota</em>' ] ] ], '<em>nota</em>' ],
];
foreach ( $casos as [ $tipo, $props, $espera ] ) {
	$out = pinta( $tipo, $props );
	comprueba( str_contains( $out, $espera ), "«{$tipo}» respeta el formato del texto" );
}

echo "\nPRUEBA 6 — el texto que se revela palabra a palabra\n";

$st_simple = pinta( 'scroll-text', [ 'text' => 'Tres palabras sueltas' ] );
comprueba( substr_count( $st_simple, 'm-st-w' ) === 3, 'sin formato se sigue partiendo en palabras' );
$st_rico = pinta( 'scroll-text', [ 'text' => 'Tres <strong>palabras</strong> sueltas' ] );
comprueba( substr_count( $st_rico, 'm-st-w' ) === 1, 'con formato se escribe de una pieza' );

echo "\nPRUEBA 7 — el «alt» de una foto no lleva etiquetas\n";

$alt = ComponentRenders::texto_plano( 'MIEL <strong>cruda</strong> &amp; pura' );
comprueba( 'MIEL cruda & pura' === $alt, "en un atributo va el texto pelado («{$alt}»)" );

echo "\nPRUEBA 8 — la tipografía del menú de la cabecera\n";

update_option( MERIDIAN_OPTION_HEADER, Menus::default_header(), false );
$css_limpio = Chrome::css();
comprueba( ! str_contains( $css_limpio, '.m-site-header .m-nav-list a,.m-site-header .m-nav-toggle{font' ),
	'sin elegir nada no se escribe ninguna regla: manda el tema' );

$h = Menus::save_header(
	array_merge(
		Menus::default_header(),
		[
			'navFont'      => 'Archivo, sans-serif',
			'navWeight'    => '700',
			'navSize'      => 18,
			'navTransform' => 'uppercase',
			'navTracking'  => 12,
			'navStyle'     => 'italic',
		]
	)
);
update_option( MERIDIAN_OPTION_HEADER, $h, false );
$leido = Menus::header();
comprueba( 'Archivo, sans-serif' === $leido['navFont'], 'la familia se guarda y se recupera' );
comprueba( 18 === $leido['navSize'] && '700' === $leido['navWeight'], 'el tamaño y el peso también' );

$css = Chrome::css();
comprueba( str_contains( $css, 'font-family:Archivo, sans-serif' ), 'y el CSS de la cabecera la escribe' );
comprueba( str_contains( $css, 'font-weight:700' ), 'con su peso' );
comprueba( str_contains( $css, 'font-size:18px' ), 'con su tamaño' );
comprueba( str_contains( $css, 'text-transform:uppercase' ), 'con su caja' );
comprueba( str_contains( $css, 'letter-spacing:0.12em' ), 'y con su espaciado entre letras' );
comprueba( str_contains( $css, '.m-site-header .m-nav-list a' ), 'sobre los enlaces del menú' );

$h2 = Menus::save_header( array_merge( Menus::default_header(), [ 'navFont' => '<script>x</script>Archivo' ] ) );
comprueba( ! str_contains( (string) $h2['navFont'], '<' ), 'y lo que se escribe en la familia se desinfecta' );

/* ====================================================================
 * El rótulo de la marca.
 *
 * Hasta ahora, un sitio sin logo imprimía en la cabecera el título del
 * WordPress. Ese título lo pone quien instala —y acaba siendo el nombre
 * de la carpeta, el del hosting o el de la plantilla con la que se hizo
 * la demo—, así que aparecía publicada en la web una palabra que nadie
 * había escrito ahí. Ahora es un campo de la cabecera y del pie, con un
 * marcador de fábrica que dice lo que hay que hacer.
 * ==================================================================== */
echo "\nPRUEBA 8 bis — el rótulo de la marca no lo pone WordPress\n";

$cab_def = Menus::default_header();
$pie_def = Menus::default_footer();
comprueba( 'Tu logo aquí' === ( $cab_def['logoText'] ?? '' ), 'de fábrica, la cabecera dice «Tu logo aquí»' );
comprueba( 'Tu logo aquí' === ( $pie_def['logoText'] ?? '' ), 'y el pie, lo mismo' );
comprueba( 'Sitio de prueba' !== ( $cab_def['logoText'] ?? '' ), 'nunca el título del WordPress («Sitio de prueba»)' );

$cab_mia = Menus::save_header( array_merge( $cab_def, [ 'logoText' => 'Casa Mar' ] ) );
comprueba( 'Casa Mar' === $cab_mia['logoText'], 'lo que escribe el dueño se guarda tal cual' );
comprueba( 'Casa Mar' === Menus::marca( $cab_mia ), 'y es lo que se lee' );
$cab_sucia = Menus::save_header( array_merge( $cab_def, [ 'logoText' => '<script>x</script>Casa' ] ) );
comprueba( ! str_contains( (string) $cab_sucia['logoText'], '<' ), 'y se desinfecta como todo lo demás' );

$cab_vacia = Menus::save_header( array_merge( $cab_def, [ 'logoText' => '' ] ) );
comprueba( '' === $cab_vacia['logoText'], 'se puede dejar vacío a propósito: sólo el logo' );
comprueba( 'Sitio de prueba' === Menus::marca( $cab_vacia ),
	'y entonces el nombre del sitio sólo sirve de «alt» para quien no ve la imagen' );

$vieja = Menus::save_header( $cab_def );
unset( $vieja['logoText'] );
update_option( MERIDIAN_OPTION_HEADER, $vieja, false );
comprueba( 'Tu logo aquí' === ( Menus::header()['logoText'] ?? '' ),
	'una cabecera guardada antes de que esto existiera también lo recibe' );
update_option( MERIDIAN_OPTION_HEADER, Menus::default_header(), false );

/* Nada de fábrica publica un nombre que no sea del dueño del sitio: ni
 * el del WordPress, ni el de este CMS, ni uno inventado en una demo.
 * El pie los imprimía los tres. */
$pie_guardado = Menus::save_footer( $pie_def );
foreach ( [ 'logoText', 'text', 'copyright' ] as $campo ) {
	$valor = (string) ( $pie_guardado[ $campo ] ?? '' );
	comprueba(
		! preg_match( '/KRG|Novamix|Sitio de prueba/i', $valor ),
		"el pie no publica ningún nombre ajeno en «{$campo}» («{$valor}»)"
	);
}
comprueba( str_contains( (string) $pie_guardado['copyright'], gmdate( 'Y' ) ), 'el copyright sí lleva el año' );

$clasico = Menus::classic_section( array_merge( $pie_def, [ 'logoText' => 'Casa Mar' ] ) );
$json_clasico = wp_json_encode( $clasico );
comprueba( str_contains( (string) $json_clasico, 'Casa Mar' ), 'el pie clásico monta el rótulo de la marca' );
comprueba( ! str_contains( (string) $json_clasico, 'Sitio de prueba' ), 'y no el título del WordPress' );
$clasico_vacio = wp_json_encode( Menus::classic_section( array_merge( $pie_def, [ 'logoText' => '' ] ) ) );
comprueba( ! str_contains( (string) $clasico_vacio, 'Sitio de prueba' ),
	'sin rótulo no se inventa ninguno' );

echo "\nPRUEBA 9 — la cuarta familia tipográfica\n";

update_option(
	MERIDIAN_OPTION_TOKENS,
	[
		'activePreset' => 'marca',
		'version'      => 1,
		'tokens'       => [
			'color'   => [ 'primary' => [ 'value' => '#3f5e58' ] ],
			'font'    => [
				'heading' => [ 'value' => 'Archivo, sans-serif', 'weight' => '800' ],
				'body'    => [ 'value' => 'Inter, sans-serif' ],
				'display' => [ 'value' => '' ],
				'ui'      => [ 'value' => 'Inter Tight, sans-serif', 'weight' => '500' ],
			],
			'spacing' => [ 'section' => '96px' ],
			'radius'  => [ 'md' => '12px' ],
		],
	],
	false
);
$hoja = TokenCompiler::css( \Meridian\Design\TokenRepository::get() );
comprueba( str_contains( $hoja, '--font-ui: Inter Tight, sans-serif;' ), 'la familia nueva sale como «--font-ui»' );
comprueba( str_contains( $hoja, '--font-ui-weight: 500;' ), 'con su peso' );
comprueba( ! str_contains( $hoja, '--font-display:' ), 'una familia en blanco no escribe variable: así el respaldo funciona' );

$modules = file_get_contents( dirname( __DIR__ ) . '/krg-cms/assets/css/modules.css' );
comprueba( substr_count( $modules, 'var(--font-ui, var(--font-heading))' ) >= 30,
	'los textos de interfaz la consumen con los títulos de respaldo' );
comprueba( str_contains( $modules, '.m-site-header .m-nav-list a' ), 'el menú entre ellos' );
comprueba( str_contains( $modules, 'var(--font-display, var(--font-heading))' ),
	'y la familia «Display» por fin se usa en los rótulos grandes' );
foreach ( [ '.m-eyebrow', '.m-btn', '.m-chip', '.m-muted' ] as $sel ) {
	$pos = strpos( $modules, "\n$sel {" );
	$trozo = false !== $pos ? substr( $modules, $pos, 400 ) : '';
	comprueba( str_contains( $trozo, '--font-ui' ), "«{$sel}» usa la familia de texto general" );
}

echo "\n";
if ( $fallos ) {
	echo "HAY $fallos FALLOS ($ok comprobaciones correctas)\n";
	exit( 1 );
}
echo "EL TEXTO CON FORMATO Y LAS TIPOGRAFÍAS VAN ($ok comprobaciones)\n";
