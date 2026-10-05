<?php
/**
 * Que la fuente elegida se descargue de verdad.
 *
 * El fallo que esto vigila: el panel dejaba elegir «Questrial», el CSS
 * del sitio decía `font-family: Questrial, sans-serif` —el inspector lo
 * enseñaba tal cual— y sin embargo la página se veía con Arial. Nadie
 * pedía el archivo de la fuente: el cargador solo sabía bajar las
 * treinta y una familias que llevaba escritas dentro, y Questrial no
 * estaba entre ellas.
 *
 * Declarar una familia y cargarla son dos cosas distintas, y el banco
 * comprueba la segunda, que es la que faltaba:
 *
 *   1. Una familia del catálogo se pide a Google con sus pesos reales.
 *   2. Una familia que solo existe en un peso NO pide los demás: si se
 *      piden, el navegador engorda la letra él solo y deja de parecerse
 *      a la original.
 *   3. Una familia escrita a mano se pide igual, en su propia hoja,
 *      para que un nombre mal escrito no se lleve por delante al resto.
 *   4. Una familia del sistema no pide nada: ya está en el ordenador.
 *   5. La tipografía de la cabecera y la del pie también cuentan,
 *      aunque vivan fuera de los tokens.
 *
 *   .tools/php/php tools/prueba-fuentes.php
 */

define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
foreach (
	[
		'/core/design/PresetStore.php',
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/design/FontCatalog.php',
	] as $f
) {
	require_once $base . $f;
}

use Meridian\Design\FontCatalog;

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

/** Deja una instalación con estas familias y devuelve las hojas encoladas. */
function monta( array $font, array $header = [], array $footer = [] ): array {
	$GLOBALS['krg_styles'] = [];
	update_option(
		MERIDIAN_OPTION_TOKENS,
		[
			'activePreset' => 'marca',
			'version'      => 1,
			'tokens'       => [
				'color'   => [ 'primary' => [ 'value' => '#3f5e58' ] ],
				'font'    => $font,
				'spacing' => [ 'section' => '96px' ],
			],
		],
		false
	);
	update_option( MERIDIAN_OPTION_HEADER, $header, false );
	update_option( MERIDIAN_OPTION_FOOTER, $footer, false );
	FontCatalog::enqueue_used();
	return $GLOBALS['krg_styles'] ?? [];
}

/** Todas las URLs encoladas, juntas, para buscar dentro. */
function urls( array $hojas ): string {
	return implode( ' ', array_map( static fn( $h ) => urldecode( (string) ( $h['src'] ?? '' ) ), $hojas ) );
}

echo "\nPRUEBA 1 — el catálogo tiene las familias y sus pesos de verdad\n";

$cat = FontCatalog::list();
$por_nombre = [];
foreach ( $cat as $f ) {
	$por_nombre[ $f['name'] ] = $f;
}
comprueba( count( $cat ) > 60, 'hay más de sesenta familias donde elegir (' . count( $cat ) . ')' );
comprueba( isset( $por_nombre['Questrial'] ), 'Questrial está en el catálogo' );
comprueba( isset( $por_nombre['Jost'], $por_nombre['Fraunces'], $por_nombre['Instrument Serif'] ), 'y otras que no estaban' );
comprueba( [ '400' ] === ( $por_nombre['Questrial']['weights'] ?? [] ), 'Questrial declara un solo peso: 400' );
comprueba( count( $por_nombre['Questrial']['variants'] ?? [] ) === 1, 'así que el selector de variante ofrece una sola opción, no diez' );
comprueba( count( $por_nombre['Inter']['variants'] ?? [] ) > 10, 'y una familia completa como Inter sigue ofreciendo todas' );
comprueba( [ '400' ] === ( $por_nombre['Anton']['weights'] ?? [] ), 'Anton también es de un solo peso' );

echo "\nPRUEBA 2 — una familia del catálogo se descarga\n";

$hojas = monta(
	[
		'heading' => [ 'value' => 'Archivo, sans-serif', 'weight' => '800' ],
		'body'    => [ 'value' => '"Inter", sans-serif' ],
	]
);
$u = urls( $hojas );
comprueba( str_contains( $u, 'fonts.googleapis.com' ), 'se pide la hoja de Google' );
comprueba( str_contains( $u, 'family=Archivo' ) && str_contains( $u, 'family=Inter' ), 'con las dos familias en la misma petición' );
comprueba( str_contains( $u, 'display=swap' ), 'y con «display=swap», para que el texto se vea mientras llega' );

echo "\nPRUEBA 3 — Questrial, el caso que estaba roto\n";

$hojas = monta( [ 'ui' => [ 'value' => 'Questrial, sans-serif', 'weight' => '400' ] ] );
$u = urls( $hojas );
comprueba( str_contains( $u, 'family=Questrial' ), 'elegirla en «Texto general» pide el archivo' );
comprueba( ! str_contains( $u, 'Questrial:ital' ) && ! str_contains( $u, 'Questrial:wght' ),
	"y no se le piden pesos que no tiene ($u)" );

echo "\nPRUEBA 4 — una familia escrita a mano\n";

$hojas = monta( [ 'ui' => [ 'value' => '"Mi Fuente Rara", sans-serif', 'google' => 'Mi Fuente Rara' ] ] );
$u = urls( $hojas );
comprueba( str_contains( $u, 'family=Mi Fuente Rara' ), 'marcando «Cargar desde Google Fonts» se pide igual' );
comprueba( count( $hojas ) === 1, 'en su propia hoja: si el nombre está mal, cae ella sola' );

$hojas = monta(
	[
		'heading' => [ 'value' => 'Archivo, sans-serif' ],
		'ui'      => [ 'value' => '"Mi Fuente Rara", sans-serif', 'google' => 'Mi Fuente Rara' ],
	]
);
comprueba( count( $hojas ) === 2, 'y la del catálogo va aparte, en la suya (' . count( $hojas ) . ' hojas)' );

$hojas = monta( [ 'ui' => [ 'value' => '"Mi Fuente Alojada", sans-serif' ] ] );
comprueba( 0 === count( $hojas ), 'sin marcar la casilla no se pide nada a Google: quizá la sirve el propio sitio' );

echo "\nPRUEBA 5 — una familia del sistema no pide nada\n";

$hojas = monta( [ 'body' => [ 'value' => 'Georgia, "Times New Roman", serif' ] ] );
comprueba( 0 === count( $hojas ), 'Georgia ya está en el ordenador de quien mira la página' );

echo "\nPRUEBA 6 — la cabecera y el pie también cuentan\n";

$hojas = monta( [], [ 'navFont' => '"Bebas Neue", sans-serif' ] );
$u = urls( $hojas );
comprueba( str_contains( $u, 'family=Bebas Neue' ), 'la tipografía del menú se descarga aunque no esté en los tokens' );
comprueba( ! str_contains( $u, 'Bebas Neue:' ), 'y sin pedirle los pesos que no tiene' );

$hojas = monta( [], [], [ 'copyrightFont' => '"Lora", serif' ] );
comprueba( str_contains( urls( $hojas ), 'family=Lora' ), 'y la del copyright del pie, igual' );

echo "\nPRUEBA 7 — las cuatro familias a la vez\n";

$hojas = monta(
	[
		'heading' => [ 'value' => '"Playfair Display", serif', 'weight' => '700' ],
		'body'    => [ 'value' => '"Lora", serif' ],
		'display' => [ 'value' => '"Bebas Neue", sans-serif' ],
		'ui'      => [ 'value' => 'Questrial, sans-serif' ],
	],
	[ 'navFont' => '"Jost", sans-serif' ]
);
$u = urls( $hojas );
foreach ( [ 'Playfair Display', 'Lora', 'Bebas Neue', 'Questrial', 'Jost' ] as $fam ) {
	comprueba( str_contains( $u, 'family=' . $fam ), "«{$fam}» se descarga" );
}
comprueba( 1 === count( $hojas ), 'las cinco en una sola petición (' . count( $hojas ) . ')' );
comprueba( substr_count( $u, 'display=swap' ) === 1, 'con un solo «display=swap» al final' );

echo "\nPRUEBA 8 — lo que el CSS declara y lo que se descarga coinciden\n";

$hoja = \Meridian\Design\TokenCompiler::css( \Meridian\Design\TokenRepository::get() );
preg_match_all( '/--font-[a-z]+: ([^;]+);/', $hoja, $m );
$declaradas = $m[1] ?? [];
comprueba( count( $declaradas ) === 4, 'el CSS declara las cuatro familias (' . count( $declaradas ) . ')' );
$faltan = [];
foreach ( $declaradas as $decl ) {
	$nombre = trim( explode( ',', $decl )[0], " \"'" );
	if ( ! str_contains( $u, 'family=' . $nombre ) ) {
		$faltan[] = $nombre;
	}
}
comprueba( ! $faltan, $faltan ? 'se declaran sin descargarse: ' . implode( ', ', $faltan ) : 'y ninguna se queda sin descargar' );

echo "\nPRUEBA 9 — una fuente subida a la Biblioteca de WordPress\n";

/** Deja una familia instalada en la Biblioteca, con sus caras. */
function instala_fuente( string $familia, array $caras, int $id = 900 ): void {
	$GLOBALS['krg_posts'][] = (object) [
		'ID'           => $id,
		'post_type'    => 'wp_font_family',
		'post_parent'  => 0,
		'post_title'   => $familia,
		'post_content' => wp_json_encode( [ 'fontFamily' => '"' . $familia . '", serif' ] ),
	];
	$n = $id * 10;
	foreach ( $caras as $cara ) {
		$GLOBALS['krg_posts'][] = (object) [
			'ID'           => ++$n,
			'post_type'    => 'wp_font_face',
			'post_parent'  => $id,
			'post_title'   => $familia,
			'post_content' => wp_json_encode( $cara ),
		];
	}
}

/** El CSS en linea de todas las hojas, junto. */
function css_de( array $hojas ): string {
	return implode( '', array_map( static fn( $h ) => (string) ( $h['inline'] ?? '' ), $hojas ) );
}

$subida = 'http://ejemplo.test/wp-content/uploads/fonts/Baskervville-Bold.ttf';
$GLOBALS['krg_posts'] = [];
instala_fuente(
	'Baskervville',
	[
		[ 'fontFamily' => 'Baskervville', 'fontWeight' => '700', 'fontStyle' => 'normal', 'src' => [ $subida ] ],
		// La misma cara repetida: WordPress a veces la guarda dos veces.
		[ 'fontFamily' => 'Baskervville', 'fontWeight' => '700', 'fontStyle' => 'normal', 'src' => [ $subida ] ],
		[ 'fontFamily' => 'Baskervville', 'fontWeight' => '400', 'fontStyle' => 'italic', 'src' => [ 'http://ejemplo.test/wp-content/uploads/fonts/Baskervville-Italic.woff2' ] ],
	]
);

$hojas = monta( [ 'heading' => [ 'value' => '"Baskervville", serif', 'weight' => '700' ] ] );
$css   = css_de( $hojas );

comprueba( str_contains( $css, '@font-face' ), 'se declara la fuente instalada' );
comprueba(
	! str_contains( $css, 'http://ejemplo.test' ),
	'y ninguna dirección se queda en http: el navegador las bloquearía por contenido mixto'
);
comprueba( str_contains( $css, 'https://ejemplo.test/wp-content/uploads/fonts/Baskervville-Bold.ttf' ), 'la dirección guardada sube a https' );
comprueba( str_contains( $css, 'Baskervville-Bold.ttf") format("truetype")' ), 'un .ttf se declara como truetype, no como woff2' );
comprueba( str_contains( $css, 'Baskervville-Italic.woff2") format("woff2")' ), 'y un .woff2 como woff2' );
comprueba( 2 === substr_count( $css, '@font-face' ), 'la cara repetida se declara una sola vez (' . substr_count( $css, '@font-face' ) . ')' );
comprueba( str_contains( $css, 'font-weight:700' ) && str_contains( $css, 'font-style:italic' ), 'con el peso y el estilo de cada cara' );
comprueba( str_contains( $css, 'font-display:swap' ), 'y con «display:swap»' );

$hojas = monta( [ 'heading' => [ 'value' => 'Georgia, serif' ] ] );
comprueba( '' === css_de( $hojas ), 'si no se usa, no se declara: no se bajan fuentes que nadie pide' );

$GLOBALS['krg_posts'] = [];
instala_fuente(
	'Fuente Del Tema',
	[ [ 'fontWeight' => '400', 'fontStyle' => 'normal', 'src' => [ 'file:./assets/fonts/tema.woff2' ] ] ],
	901
);
$css = css_de( monta( [ 'body' => [ 'value' => '"Fuente Del Tema", sans-serif' ] ] ) );
comprueba( str_contains( $css, 'themes/krg-cms/assets/fonts/tema.woff2' ), 'el atajo «file:./» del theme.json se resuelve contra la carpeta del tema' );

$GLOBALS['krg_posts'] = [];
instala_fuente(
	'Dos Archivos',
	[ [ 'fontWeight' => '400', 'fontStyle' => 'normal', 'src' => [ 'https://ejemplo.test/f/a.woff2', 'https://ejemplo.test/f/a.ttf' ] ] ],
	902
);
$css = css_de( monta( [ 'body' => [ 'value' => '"Dos Archivos", sans-serif' ] ] ) );
comprueba(
	str_contains( $css, 'a.woff2") format("woff2"),url("https://ejemplo.test/f/a.ttf") format("truetype")' ),
	'una cara con dos archivos los declara los dos, por orden'
);
$GLOBALS['krg_posts'] = [];

echo "\nPRUEBA 10 — un sitio que de verdad va por http se queda como está\n";

$GLOBALS['krg_home'] = 'http://ejemplo.test';
comprueba( 'http://ejemplo.test/f/a.ttf' === FontCatalog::secure_url( 'http://ejemplo.test/f/a.ttf' ), 'ahí http es lo correcto y no se toca' );
$GLOBALS['krg_home'] = 'https://ejemplo.test';
comprueba( 'https://ejemplo.test/f/a.ttf' === FontCatalog::secure_url( 'http://ejemplo.test/f/a.ttf' ), 'y en uno por https, sube' );
comprueba( '//cdn.test/a.ttf' === FontCatalog::secure_url( '//cdn.test/a.ttf' ), 'una dirección sin esquema ya vale para las dos' );

echo "\nPRUEBA 11 — las fuentes que imprime el propio WordPress\n";

/** Un remedo del objeto que WordPress pasa por «wp_theme_json_data_user». */
class DatosTemaJson {
	public array $datos;
	public function __construct( array $datos ) {
		$this->datos = $datos;
	}
	public function get_data(): array {
		return $this->datos;
	}
	public function update_with( array $nuevo ): void {
		$this->datos = array_replace_recursive( $this->datos, $nuevo );
	}
}

$entrada = new DatosTemaJson(
	[
		'version'  => 3,
		'settings' => [
			'typography' => [
				'fontFamilies' => [
					'custom' => [
						[
							'fontFamily' => '"Outfit", sans-serif',
							'slug'       => 'outfit',
							'fontFace'   => [
								[ 'fontWeight' => '100 900', 'src' => [ 'http://ejemplo.test/wp-content/uploads/fonts/Outfit-VariableFont_wght.ttf' ] ],
							],
						],
					],
				],
			],
		],
	]
);
$salida = FontCatalog::secure_theme_json( $entrada );
$cara   = $salida->get_data()['settings']['typography']['fontFamilies']['custom'][0]['fontFace'][0]['src'][0];
comprueba( 'https://ejemplo.test/wp-content/uploads/fonts/Outfit-VariableFont_wght.ttf' === $cara, 'también se les corrige el esquema a las de los estilos globales' );
comprueba( 3 === $salida->get_data()['version'], 'sin tocar el resto del theme.json' );
comprueba( FontCatalog::secure_theme_json( 'no es un objeto' ) === 'no es un objeto', 'y si llega algo que no es lo esperado, se devuelve tal cual' );

echo "\n";
if ( $fallos ) {
	echo "HAY $fallos FALLOS ($ok comprobaciones correctas)\n";
	exit( 1 );
}
echo "LAS FUENTES SE DESCARGAN ($ok comprobaciones)\n";
