<?php
/**
 * Las familias tipograficas: del sistema, del catalogo web y las que
 * WordPress tenga instaladas.
 *
 * Aqui no solo se LISTAN las fuentes: tambien se CARGAN. Y esa segunda
 * mitad es la que estaba rota. El panel dejaba escribir cualquier
 * familia, el CSS la declaraba... y nadie pedia el archivo, asi que el
 * navegador se quedaba con la de respaldo (Arial) mientras el inspector
 * ensenaba el nombre correcto. Dos agujeros:
 *
 *   1. Solo se cargaba una familia si estaba en el catalogo de abajo.
 *      Una escrita a mano —«Questrial»— no se pedia nunca.
 *   2. La tipografia de la cabecera y la del pie no se miraban: viven
 *      en sus propias opciones, no en los tokens.
 *
 * Ahora esta clase es el UNICO sitio que carga fuentes, en el panel y
 * en la web, y mira los tres sitios donde puede haber una elegida:
 * los tokens, los estilos del documento y la cabecera/pie.
 *
 * @package Meridian
 */

namespace Meridian\Design;

defined( 'ABSPATH' ) || exit;

class FontCatalog {

	public static function list(): array {
		$out  = [];
		$seen = [];
		foreach ( array_merge( self::wordpress(), self::web(), self::system() ) as $item ) {
			$key = strtolower( preg_replace( '/\s+/', '', $item['css'] ) );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $item;
		}
		return $out;
	}

	/**
	 * Carga las fuentes que el sitio usa de verdad.
	 *
	 * Tres sitios donde puede haber una familia elegida: los tokens
	 * (Titulos, Cuerpo, Display y Texto general), los estilos sueltos de
	 * un bloque del documento, y la cabecera y el pie, que guardan la
	 * suya aparte. Los tres se miran aqui.
	 *
	 * Lo que se emite:
	 *
	 *   - Una sola hoja de Google con todas las familias del catalogo,
	 *     pidiendo **solo los pesos que esa familia tiene**.
	 *   - Una hoja aparte por cada familia escrita a mano que el usuario
	 *     haya marcado como de Google: si una esta mal escrita, cae ella
	 *     sola y no se lleva por delante a las demas.
	 *   - Un `@font-face` por cada fuente instalada en WordPress.
	 *
	 * Una familia del sistema (Arial, Georgia…) no pide nada: ya esta en
	 * el ordenador de quien mira la pagina.
	 */
	public static function enqueue_used( string $handle = 'krg-base' ): void {
		[ $used, $sueltas ] = self::used_families();
		if ( ! $used && ! $sueltas ) {
			return;
		}
		$catalogo = self::list();
		$google   = [];
		$faces    = [];
		foreach ( $catalogo as $f ) {
			if ( ! self::family_in_use( $f, $used ) ) {
				continue;
			}
			if ( ! empty( $f['google'] ) ) {
				$google[ $f['google'] ] = $f;
			}
			if ( ! empty( $f['faces'] ) && is_array( $f['faces'] ) ) {
				$faces = array_merge( $faces, $f['faces'] );
			}
		}
		$urls = [];
		if ( $google ) {
			$partes = [];
			foreach ( $google as $familia => $f ) {
				$partes[] = self::google_family_param( $familia, $f['weights'] ?? [], ! empty( $f['italic'] ) );
			}
			$urls['krg-fonts'] = 'https://fonts.googleapis.com/css2?' . implode( '&', $partes ) . '&display=swap';
		}
		// Las escritas a mano: una hoja por familia y sin pedir pesos
		// concretos, porque no sabemos cuales tiene. Google devuelve los
		// que existan.
		$ya = array_map( [ self::class, 'normalize' ], array_keys( $google ) );
		foreach ( $sueltas as $familia ) {
			if ( in_array( self::normalize( $familia ), $ya, true ) ) {
				continue;
			}
			$slug          = sanitize_title( $familia );
			$urls[ 'krg-font-' . $slug ] = 'https://fonts.googleapis.com/css2?'
				. self::google_family_param( $familia, [], true ) . '&display=swap';
			// Si la familia no tiene alguno de esos pesos, Google
			// devuelve los que sí tenga: comprobado, no da error.
		}
		foreach ( $urls as $id => $url ) {
			wp_enqueue_style( $id, $url, [], null );
		}
		if ( $urls && function_exists( 'add_filter' ) ) {
			add_filter(
				'wp_resource_hints',
				static function ( $hints, $rel ) {
					if ( 'preconnect' === $rel ) {
						$hints[] = [
							'href'        => 'https://fonts.gstatic.com',
							'crossorigin' => 'anonymous',
						];
					}
					return $hints;
				},
				10,
				2
			);
		}
		if ( $faces ) {
			$css = self::faces_css( $faces );
			if ( $css ) {
				if ( ! wp_style_is( $handle, 'registered' ) && ! wp_style_is( $handle, 'enqueued' ) ) {
					$handle = 'krg-font-faces';
					wp_register_style( $handle, false, [], MERIDIAN_VERSION );
					wp_enqueue_style( $handle );
				}
				wp_add_inline_style( $handle, $css );
			}
		}
	}

	/**
	 * Las reglas `@font-face` de las fuentes instaladas en WordPress.
	 *
	 * Este trozo tambien estaba roto, y de dos formas distintas que se
	 * veian igual —la letra no cambiaba:
	 *
	 *   1. La direccion del archivo se escribia tal cual estaba
	 *      guardada. WordPress la guarda entera —con `http://`— el dia
	 *      que se sube la fuente; si el sitio pasa despues a `https://`
	 *      esa direccion se queda en `http://` para siempre y el
	 *      navegador la bloquea entera por «contenido mixto». Ni
	 *      siquiera llega a pedirla.
	 *   2. Se declaraba `format("woff2")` para todos los archivos,
	 *      incluidos los `.ttf`. El navegador se fia de esa etiqueta:
	 *      si dice woff2 y el archivo es otra cosa, descarta la fuente
	 *      sin intentarlo.
	 *
	 * Asi que aqui: la direccion se resuelve y se asegura, el formato
	 * sale de la extension real y no se repite dos veces la misma cara.
	 */
	public static function faces_css( array $faces ): string {
		$css   = '';
		$visto = [];
		foreach ( $faces as $face ) {
			$brutas = $face['srcs'] ?? [ $face['src'] ?? '' ];
			$partes = [];
			foreach ( (array) $brutas as $bruta ) {
				$url = self::css_url( self::face_src( (string) $bruta ) );
				if ( '' === $url ) {
					continue;
				}
				$partes[] = 'url("' . $url . '") format("' . self::src_format( $url ) . '")';
			}
			$familia = self::css_family( (string) ( $face['family'] ?? '' ) );
			if ( ! $partes || '' === $familia ) {
				continue;
			}
			$peso   = self::css_token( (string) ( $face['weight'] ?? '400' ) ) ?: '400';
			$estilo = self::css_token( (string) ( $face['style'] ?? 'normal' ) ) ?: 'normal';
			$clave  = strtolower( $familia . '|' . $peso . '|' . $estilo . '|' . implode( ',', $partes ) );
			if ( isset( $visto[ $clave ] ) ) {
				continue;
			}
			$visto[ $clave ] = true;
			$css            .= '@font-face{font-family:' . $familia . ';src:' . implode( ',', $partes )
				. ';font-weight:' . $peso . ';font-style:' . $estilo . ';font-display:swap;}';
		}
		return $css;
	}

	/**
	 * La direccion de un archivo de fuente, lista para meter en el CSS.
	 *
	 * Admite las dos formas que usa WordPress: la direccion completa
	 * que guarda la Biblioteca de fuentes y el atajo `file:./…` de los
	 * `theme.json`, que va relativo a la carpeta del tema.
	 */
	public static function face_src( string $src ): string {
		$src = trim( $src );
		if ( '' === $src ) {
			return '';
		}
		if ( 0 === stripos( $src, 'file:' ) ) {
			$rel  = (string) preg_replace( '#^file:/*(\./)*#i', '', $src );
			$base = '';
			if ( function_exists( 'get_theme_file_uri' ) ) {
				$base = (string) get_theme_file_uri();
			} elseif ( function_exists( 'get_template_directory_uri' ) ) {
				$base = (string) get_template_directory_uri();
			}
			$src = $base ? rtrim( $base, '/' ) . '/' . ltrim( $rel, '/' ) : $rel;
		}
		return self::secure_url( $src );
	}

	/**
	 * Sube a `https://` una direccion guardada en `http://`.
	 *
	 * Solo cuando el sitio se sirve por https, que es cuando el
	 * navegador bloquea lo demas. En un sitio por http se deja igual:
	 * ahi `http://` es lo correcto.
	 *
	 * No vale con mirar `is_ssl()`: detras de un proxy o de un CDN
	 * —LiteSpeed, Cloudflare— puede decir que no aunque el visitante
	 * este en https. Si la direccion del sitio empieza por `https://`,
	 * la pagina es https.
	 */
	public static function secure_url( string $url ): string {
		if ( 0 !== stripos( $url, 'http://' ) || ! self::site_is_https() ) {
			return $url;
		}
		return 'https://' . substr( $url, 7 );
	}

	private static function site_is_https(): bool {
		if ( function_exists( 'is_ssl' ) && is_ssl() ) {
			return true;
		}
		foreach ( [ 'home_url', 'site_url' ] as $fn ) {
			if ( function_exists( $fn ) && 0 === stripos( (string) $fn( '/' ), 'https://' ) ) {
				return true;
			}
		}
		return false;
	}

	/** El `format(…)` que toca, sacado de la extension del archivo. */
	private static function src_format( string $url ): string {
		$ruta = (string) parse_url( $url, PHP_URL_PATH );
		$ext  = strtolower( (string) pathinfo( $ruta, PATHINFO_EXTENSION ) );
		$mapa = [
			'woff2' => 'woff2',
			'woff'  => 'woff',
			'ttf'   => 'truetype',
			'otf'   => 'opentype',
			'eot'   => 'embedded-opentype',
			'svg'   => 'svg',
		];
		return $mapa[ $ext ] ?? 'woff2';
	}

	/**
	 * La direccion, sin ningun caracter que pueda cerrar el `url("…")`
	 * y colarse en la hoja. No se descarta nada: se codifica, que en
	 * una direccion es lo mismo y la fuente sigue cargando.
	 */
	private static function css_url( string $url ): string {
		return strtr(
			trim( $url ),
			[
				' '  => '%20',
				'"'  => '%22',
				"'"  => '%27',
				'('  => '%28',
				')'  => '%29',
				'\\' => '%5C',
				'<'  => '%3C',
				'>'  => '%3E',
				"\n" => '',
				"\r" => '',
				"\t" => '',
			]
		);
	}

	/** Nada que pueda cerrar la regla y colarse en la hoja. */
	private static function css_token( string $v ): string {
		return trim( (string) preg_replace( '/[^0-9A-Za-z .%-]/', '', $v ) );
	}

	private static function css_family( string $v ): string {
		$v = self::css_token( str_replace( [ '"', "'" ], '', $v ) );
		return '' === $v ? '' : '"' . $v . '"';
	}

	/**
	 * Arregla las direcciones de las fuentes que WordPress declara por
	 * su cuenta.
	 *
	 * El tema no es el unico que pinta `@font-face`: las fuentes que
	 * esten activadas en los estilos globales las imprime el propio
	 * WordPress, con las mismas direcciones `http://` guardadas. Si
	 * solo arreglasemos las nuestras, esas seguirian bloqueadas y la
	 * letra seguiria sin cambiar. Esto se engancha donde WordPress
	 * resuelve su `theme.json` —antes de imprimir nada— y le corrige
	 * el esquema. No toca la base de datos: es solo de lectura.
	 */
	public static function secure_theme_json( $data ) {
		if ( ! is_object( $data ) || ! method_exists( $data, 'get_data' ) || ! method_exists( $data, 'update_with' ) ) {
			return $data;
		}
		if ( ! self::site_is_https() ) {
			return $data;
		}
		$raw      = $data->get_data();
		$familias = $raw['settings']['typography']['fontFamilies'] ?? null;
		if ( ! is_array( $familias ) ) {
			return $data;
		}
		$tocado   = false;
		$familias = self::secure_font_families( $familias, $tocado );
		if ( ! $tocado ) {
			return $data;
		}
		$data->update_with(
			[
				'version'  => $raw['version'] ?? 2,
				'settings' => [ 'typography' => [ 'fontFamilies' => $familias ] ],
			]
		);
		return $data;
	}

	/**
	 * Recorre la lista de familias —venga por origen (`theme`,
	 * `custom`…) o en plano— y asegura cada `src`.
	 */
	private static function secure_font_families( array $familias, bool &$tocado ): array {
		foreach ( $familias as $clave => $valor ) {
			if ( ! is_array( $valor ) ) {
				continue;
			}
			if ( ! isset( $valor['fontFamily'] ) && ! isset( $valor['fontFace'] ) ) {
				$familias[ $clave ] = self::secure_font_families( $valor, $tocado );
				continue;
			}
			if ( ! isset( $valor['fontFace'] ) || ! is_array( $valor['fontFace'] ) ) {
				continue;
			}
			foreach ( $valor['fontFace'] as $i => $cara ) {
				if ( ! is_array( $cara ) || ! isset( $cara['src'] ) ) {
					continue;
				}
				$antes = $cara['src'];
				if ( is_array( $antes ) ) {
					$despues = array_map( static fn( $s ) => is_string( $s ) ? self::secure_url( $s ) : $s, $antes );
				} elseif ( is_string( $antes ) ) {
					$despues = self::secure_url( $antes );
				} else {
					continue;
				}
				if ( $despues !== $antes ) {
					$familias[ $clave ]['fontFace'][ $i ]['src'] = $despues;
					$tocado = true;
				}
			}
		}
		return $familias;
	}

	/**
	 * El trozo `family=…` de la URL de Google.
	 *
	 * Con los pesos de la familia si los sabemos —asi la hoja pesa lo
	 * justo— y sin ellos si no, que es la forma de no equivocarse.
	 */
	private static function google_family_param( string $familia, array $weights, bool $italic, array $quiere = [] ): string {
		$param     = 'family=' . rawurlencode( $familia );
		$tiene     = array_values( array_unique( array_filter( array_map( 'strval', $weights ) ) ) );
		$quiere    = $quiere ?: self::weights_in_use();
		// Solo los pesos que el sitio usa Y la fuente tiene. Pedirlos
		// todos engorda la hoja con instancias que nadie pinta; pedir
		// uno que no existe no rompe nada —Google devuelve lo que hay—
		// pero tampoco sirve de nada.
		$pesos = $tiene ? array_values( array_intersect( $tiene, $quiere ) ) : $quiere;
		if ( ! $pesos ) {
			$pesos = $tiene ? [ $tiene[0] ] : [ '400' ];
		}
		sort( $pesos, SORT_NUMERIC );
		if ( [ '400' ] === $pesos && ! $italic ) {
			return $param;
		}
		if ( ! $italic ) {
			return $param . ':wght@' . implode( ';', $pesos );
		}
		// La cursiva solo donde hace falta: el `<em>` del texto corrido
		// y el peso que se haya configurado en cursiva. Una cursiva por
		// cada peso duplica la descarga para nada.
		$cursivas = array_values( array_intersect( $pesos, self::italic_weights_in_use() ) );
		$ejes     = [];
		foreach ( $pesos as $w ) {
			$ejes[] = '0,' . $w;
		}
		foreach ( $cursivas as $w ) {
			$ejes[] = '1,' . $w;
		}
		return $param . ':ital,wght@' . implode( ';', $ejes );
	}

	/**
	 * Los pesos que esta instalación usa de verdad.
	 *
	 * 400 y 700 siempre (el texto normal y el `<strong>`), 500 y 600
	 * porque los pide la hoja del tema para menús y botones, y encima
	 * los que haya elegido quien configura: las familias, los roles
	 * tipográficos y la cabecera y el pie.
	 */
	private static function weights_in_use(): array {
		$pesos = [ '400', '500', '600', '700' ];
		$data  = TokenRepository::get();
		foreach ( $data['tokens']['font'] ?? [] as $item ) {
			if ( is_array( $item ) && ! empty( $item['weight'] ) ) {
				$pesos[] = (string) (int) $item['weight'];
			}
		}
		foreach ( $data['tokens']['typography'] ?? [] as $rol ) {
			if ( is_array( $rol ) && ! empty( $rol['fontWeight'] ) ) {
				$pesos[] = (string) (int) $rol['fontWeight'];
			}
		}
		foreach (
			[
				[ MERIDIAN_OPTION_HEADER, 'navWeight' ],
				[ MERIDIAN_OPTION_FOOTER, 'copyrightWeight' ],
			] as [ $opcion, $clave ]
		) {
			$conf = get_option( $opcion, [] );
			if ( is_array( $conf ) && ! empty( $conf[ $clave ] ) ) {
				$pesos[] = (string) (int) $conf[ $clave ];
			}
		}
		$pesos = array_values( array_unique( array_filter( $pesos, static fn( $w ) => $w >= '100' ) ) );
		sort( $pesos, SORT_NUMERIC );
		return $pesos;
	}

	/** Los pesos que hacen falta también en cursiva. */
	private static function italic_weights_in_use(): array {
		$pesos = [ '400' ];
		$data  = TokenRepository::get();
		foreach ( $data['tokens']['font'] ?? [] as $item ) {
			if ( is_array( $item ) && 'italic' === ( $item['style'] ?? '' ) && ! empty( $item['weight'] ) ) {
				$pesos[] = (string) (int) $item['weight'];
			}
		}
		return array_values( array_unique( $pesos ) );
	}

	/**
	 * Todo lo que el sitio declara como familia.
	 *
	 * Devuelve dos listas: los valores CSS en uso (para cruzarlos con el
	 * catalogo) y los nombres de familias escritas a mano que hay que
	 * pedirle a Google por su cuenta.
	 */
	private static function used_families(): array {
		$used    = [];
		$sueltas = [];
		$data    = TokenRepository::get();
		foreach ( $data['tokens']['font'] ?? [] as $item ) {
			$val = is_array( $item ) ? (string) ( $item['value'] ?? '' ) : (string) $item;
			if ( ! $val ) {
				continue;
			}
			$used[] = $val;
			// «Cargar desde Google Fonts» marcado en el panel para una
			// familia que no esta en el catalogo.
			if ( is_array( $item ) && ! empty( $item['google'] ) ) {
				$nombre = is_string( $item['google'] ) && '1' !== $item['google'] ? $item['google'] : $val;
				// Para pedirsela a Google hace falta el nombre tal cual
				// se escribe, con sus mayusculas: «Questrial», no
				// «"Questrial", sans-serif» ni «questrial».
				$sueltas[] = self::family_label( $nombre );
			}
		}
		if ( class_exists( '\\Meridian\\Render\\PageRenderer' ) ) {
			$doc = \Meridian\Render\PageRenderer::current_document();
			if ( is_array( $doc ) ) {
				self::collect_families( $doc['sections'] ?? [], $used );
			}
		}
		// La cabecera y el pie guardan su tipografia fuera de los tokens.
		foreach (
			[
				[ MERIDIAN_OPTION_HEADER, [ 'navFont' ] ],
				[ MERIDIAN_OPTION_FOOTER, [ 'copyrightFont' ] ],
			] as [ $opcion, $claves ]
		) {
			$conf = get_option( $opcion, [] );
			if ( ! is_array( $conf ) ) {
				continue;
			}
			foreach ( $claves as $clave ) {
				$val = (string) ( $conf[ $clave ] ?? '' );
				if ( $val ) {
					$used[] = $val;
				}
			}
		}
		$used    = array_values( array_unique( array_filter( $used ) ) );
		$sueltas = array_values( array_unique( array_filter( $sueltas ) ) );
		return [ $used, $sueltas ];
	}

	/** ¿Alguna de las familias en uso es esta del catalogo? */
	private static function family_in_use( array $f, array $used ): bool {
		$nombre = self::normalize( $f['name'] ?? '' );
		$css    = self::normalize( $f['css'] ?? '' );
		foreach ( $used as $val ) {
			$v = self::normalize( $val );
			if ( $v === $css || self::family_name( $val ) === $nombre ) {
				return true;
			}
		}
		return false;
	}

	/** El nombre de la familia dentro de una lista CSS: «"Questrial", sans-serif» → «Questrial». */
	private static function family_label( string $css ): string {
		$primera = trim( explode( ',', (string) $css )[0] ?? '' );
		return trim( $primera, "\"' \t" );
	}

	/** Lo mismo, pero en minusculas, para comparar. */
	private static function family_name( string $css ): string {
		return self::normalize( self::family_label( $css ) );
	}

	private static function normalize( string $v ): string {
		return strtolower( trim( preg_replace( '/\s+/', ' ', $v ) ) );
	}

	private static function system(): array {
		$rows = [
			[ 'Sistema (sans)', 'system-ui, -apple-system, "Segoe UI", sans-serif' ],
			[ 'Arial', 'Arial, Helvetica, sans-serif' ],
			[ 'Helvetica', 'Helvetica, Arial, sans-serif' ],
			[ 'Verdana', 'Verdana, Geneva, sans-serif' ],
			[ 'Tahoma', 'Tahoma, Verdana, sans-serif' ],
			[ 'Trebuchet MS', '"Trebuchet MS", Helvetica, sans-serif' ],
			[ 'Georgia', 'Georgia, "Times New Roman", serif' ],
			[ 'Times New Roman', '"Times New Roman", Times, serif' ],
			[ 'Palatino', 'Palatino, "Palatino Linotype", "Iowan Old Style", Georgia, serif' ],
			[ 'Garamond', 'Garamond, "Times New Roman", serif' ],
			[ 'Courier New', '"Courier New", Courier, monospace' ],
			[ 'Monospace', 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' ],
		];
		$out = [];
		foreach ( $rows as $i => $row ) {
			$out[] = [
				'id'       => 'sys-' . $i,
				'group'    => 'system',
				'name'     => $row[0],
				'css'      => $row[1],
				'google'   => '',
				'faces'    => [],
				'variants' => self::default_variants(),
			];
		}
		return $out;
	}

	/**
	 * El catalogo web: familias de Google Fonts con sus pesos de verdad.
	 *
	 * Cada fila es: nombre, familia en Google, generica de respaldo, los
	 * pesos que esa fuente tiene **realmente** y si existe en cursiva.
	 * Antes se daba por hecho que todas tenian de 300 a 700 con sus
	 * cursivas, y eso tiene dos consecuencias feas: el selector de
	 * variante ofrece pesos que no existen y, al pedirlos, el navegador
	 * se inventa la negrita (la engorda el solo) y la fuente deja de
	 * parecerse a la del modelo. Questrial o Anton, por ejemplo, solo
	 * existen en 400.
	 */
	private static function web(): array {
		$rows = [
			[ 'Inter', 'Inter', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Archivo', 'Archivo', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Archivo Black', 'Archivo Black', 'sans-serif', [ 400 ], false ],
			[ 'Archivo Narrow', 'Archivo Narrow', 'sans-serif', [ 400, 500, 600, 700 ], true ],
			[ 'Anton', 'Anton', 'sans-serif', [ 400 ], false ],
			[ 'Questrial', 'Questrial', 'sans-serif', [ 400 ], false ],
			[ 'Figtree', 'Figtree', 'sans-serif', [ 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Roboto', 'Roboto', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Open Sans', 'Open Sans', 'sans-serif', [ 300, 400, 500, 600, 700, 800 ], true ],
			[ 'Lato', 'Lato', 'sans-serif', [ 100, 300, 400, 700, 900 ], true ],
			[ 'Montserrat', 'Montserrat', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Poppins', 'Poppins', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Nunito', 'Nunito', 'sans-serif', [ 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Nunito Sans', 'Nunito Sans', 'sans-serif', [ 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Source Sans 3', 'Source Sans 3', 'sans-serif', [ 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Work Sans', 'Work Sans', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Raleway', 'Raleway', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Outfit', 'Outfit', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], false ],
			[ 'Manrope', 'Manrope', 'sans-serif', [ 200, 300, 400, 500, 600, 700, 800 ], false ],
			[ 'DM Sans', 'DM Sans', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Plus Jakarta Sans', 'Plus Jakarta Sans', 'sans-serif', [ 200, 300, 400, 500, 600, 700, 800 ], true ],
			[ 'Jost', 'Jost', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Sora', 'Sora', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800 ], false ],
			[ 'Urbanist', 'Urbanist', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Rubik', 'Rubik', 'sans-serif', [ 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Karla', 'Karla', 'sans-serif', [ 200, 300, 400, 500, 600, 700, 800 ], true ],
			[ 'Mulish', 'Mulish', 'sans-serif', [ 200, 300, 400, 500, 600, 700, 800, 900, 1000 ], true ],
			[ 'Barlow', 'Barlow', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Cabin', 'Cabin', 'sans-serif', [ 400, 500, 600, 700 ], true ],
			[ 'Josefin Sans', 'Josefin Sans', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700 ], true ],
			[ 'Quicksand', 'Quicksand', 'sans-serif', [ 300, 400, 500, 600, 700 ], false ],
			[ 'Lexend', 'Lexend', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], false ],
			[ 'Public Sans', 'Public Sans', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Epilogue', 'Epilogue', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Chivo', 'Chivo', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Red Hat Display', 'Red Hat Display', 'sans-serif', [ 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Schibsted Grotesk', 'Schibsted Grotesk', 'sans-serif', [ 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Syne', 'Syne', 'sans-serif', [ 400, 500, 600, 700, 800 ], false ],
			[ 'Space Grotesk', 'Space Grotesk', 'sans-serif', [ 300, 400, 500, 600, 700 ], false ],
			[ 'Oswald', 'Oswald', 'sans-serif', [ 200, 300, 400, 500, 600, 700 ], false ],
			[ 'Bebas Neue', 'Bebas Neue', 'sans-serif', [ 400 ], false ],
			[ 'IBM Plex Sans', 'IBM Plex Sans', 'sans-serif', [ 100, 200, 300, 400, 500, 600, 700 ], true ],
			[ 'IBM Plex Serif', 'IBM Plex Serif', 'serif', [ 100, 200, 300, 400, 500, 600, 700 ], true ],
			[ 'Playfair Display', 'Playfair Display', 'serif', [ 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Merriweather', 'Merriweather', 'serif', [ 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Lora', 'Lora', 'serif', [ 400, 500, 600, 700 ], true ],
			[ 'Cormorant Garamond', 'Cormorant Garamond', 'serif', [ 300, 400, 500, 600, 700 ], true ],
			[ 'EB Garamond', 'EB Garamond', 'serif', [ 400, 500, 600, 700, 800 ], true ],
			[ 'Libre Baskerville', 'Libre Baskerville', 'serif', [ 400, 700 ], true ],
			[ 'Source Serif 4', 'Source Serif 4', 'serif', [ 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Crimson Pro', 'Crimson Pro', 'serif', [ 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Spectral', 'Spectral', 'serif', [ 200, 300, 400, 500, 600, 700, 800 ], true ],
			[ 'Bitter', 'Bitter', 'serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Fraunces', 'Fraunces', 'serif', [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Alegreya', 'Alegreya', 'serif', [ 400, 500, 600, 700, 800, 900 ], true ],
			[ 'Vollkorn', 'Vollkorn', 'serif', [ 400, 500, 600, 700, 800, 900 ], true ],
			[ 'DM Serif Display', 'DM Serif Display', 'serif', [ 400 ], true ],
			[ 'Instrument Serif', 'Instrument Serif', 'serif', [ 400 ], true ],
			[ 'Prata', 'Prata', 'serif', [ 400 ], false ],
			[ 'Marcellus', 'Marcellus', 'serif', [ 400 ], false ],
			[ 'Italiana', 'Italiana', 'serif', [ 400 ], false ],
			[ 'Tenor Sans', 'Tenor Sans', 'sans-serif', [ 400 ], false ],
			[ 'Cinzel', 'Cinzel', 'serif', [ 400, 500, 600, 700, 800, 900 ], false ],
			[ 'Abril Fatface', 'Abril Fatface', 'serif', [ 400 ], false ],
			[ 'Lobster', 'Lobster', 'cursive', [ 400 ], false ],
			[ 'Pacifico', 'Pacifico', 'cursive', [ 400 ], false ],
			[ 'Caveat', 'Caveat', 'cursive', [ 400, 500, 600, 700 ], false ],
			[ 'Dancing Script', 'Dancing Script', 'cursive', [ 400, 500, 600, 700 ], false ],
		];
		$out = [];
		foreach ( $rows as $row ) {
			$pesos = array_map( 'strval', $row[3] );
			$out[] = [
				'id'       => 'web-' . sanitize_title( $row[1] ),
				'group'    => 'web',
				'name'     => $row[0],
				'css'      => '"' . $row[1] . '", ' . $row[2],
				'google'   => $row[1],
				'weights'  => $pesos,
				'italic'   => (bool) $row[4],
				'faces'    => [],
				'variants' => self::variants_from_weights( $pesos, (bool) $row[4] ),
			];
		}
		return $out;
	}

	/** Las variantes que de verdad existen en una familia. */
	private static function variants_from_weights( array $weights, bool $italic ): array {
		$out = [];
		foreach ( $weights as $w ) {
			$w     = (string) $w;
			$out[] = [
				'id'     => $w . '-normal',
				'label'  => self::variant_label( $w, 'normal' ),
				'weight' => $w,
				'style'  => 'normal',
			];
			if ( $italic ) {
				$out[] = [
					'id'     => $w . '-italic',
					'label'  => self::variant_label( $w, 'italic' ),
					'weight' => $w,
					'style'  => 'italic',
				];
			}
		}
		return $out ?: self::default_variants();
	}

	private static function wordpress(): array {
		$out = [];
		if ( function_exists( 'wp_get_global_settings' ) ) {
			$raw = wp_get_global_settings( [ 'typography', 'fontFamilies' ] );
			self::collect_global( $raw, $out );
		}
		if ( post_type_exists( 'wp_font_family' ) ) {
			$posts = get_posts(
				[
					'post_type'      => 'wp_font_family',
					'post_status'    => [ 'publish', 'draft' ],
					'posts_per_page' => 80,
					'orderby'        => 'title',
					'order'          => 'ASC',
				]
			);
			foreach ( $posts as $p ) {
				$data   = json_decode( (string) $p->post_content, true );
				$family = is_array( $data ) ? (string) ( $data['fontFamily'] ?? $p->post_title ) : $p->post_title;
				$css    = $family;
				if ( $css && ! str_contains( $css, ',' ) && ! str_starts_with( $css, '"' ) ) {
					$css = '"' . $family . '", sans-serif';
				}
				$faces  = [];
				$kids   = get_children(
					[
						'post_parent' => $p->ID,
						'post_type'   => 'wp_font_face',
						'numberposts' => 20,
					]
				);
				foreach ( $kids as $kid ) {
					$face = json_decode( (string) $kid->post_content, true );
					if ( ! is_array( $face ) ) {
						continue;
					}
					// Una cara puede traer varios archivos (woff2 y ttf,
					// por ejemplo). Antes se cogia solo el primero; ahora
					// van todos, y el navegador elige el que entienda.
					$srcs = [];
					foreach ( (array) ( $face['src'] ?? [] ) as $uno ) {
						$uno = self::face_src( (string) $uno );
						if ( '' !== $uno ) {
							$srcs[] = $uno;
						}
					}
					if ( $srcs ) {
						$faces[] = [
							'family' => '"' . $family . '"',
							'src'    => $srcs[0],
							'srcs'   => $srcs,
							'weight' => (string) ( $face['fontWeight'] ?? '400' ),
							'style'  => (string) ( $face['fontStyle'] ?? 'normal' ),
						];
					}
				}
				$out[] = [
					'id'       => 'wp-' . $p->ID,
					'group'    => 'wordpress',
					'name'     => $p->post_title ?: $family,
					'css'      => $css,
					'google'   => '',
					'faces'    => $faces,
					'variants' => self::variants_from_faces( $faces ),
				];
			}
		}
		return $out;
	}

	private static function collect_global( $raw, array &$out ): void {
		if ( ! is_array( $raw ) ) {
			return;
		}
		if ( isset( $raw['fontFamily'] ) ) {
			$raw = [ $raw ];
		}
		foreach ( $raw as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( isset( $item['fontFamily'] ) ) {
				$css  = (string) $item['fontFamily'];
				$name = (string) ( $item['name'] ?? $css );
				if ( ! $css ) {
					continue;
				}
				$out[] = [
					'id'       => 'wp-g-' . sanitize_title( (string) ( $item['slug'] ?? $name ) ),
					'group'    => 'wordpress',
					'name'     => $name,
					'css'      => $css,
					'google'   => '',
					'faces'    => [],
					'variants' => self::default_variants(),
				];
				continue;
			}
			self::collect_global( $item, $out );
		}
	}

	private static function default_variants(): array {
		$names = [
			'300' => 'Light',
			'400' => 'Regular',
			'500' => 'Medium',
			'600' => 'Semibold',
			'700' => 'Bold',
		];
		$out = [];
		foreach ( $names as $w => $lab ) {
			$out[] = [
				'id'     => $w . '-normal',
				'label'  => $lab,
				'weight' => $w,
				'style'  => 'normal',
			];
			$out[] = [
				'id'     => $w . '-italic',
				'label'  => ( '400' === $w ) ? 'Italic' : ( $lab . ' Italic' ),
				'weight' => $w,
				'style'  => 'italic',
			];
		}
		return $out;
	}

	private static function variant_label( string $weight, string $style ): string {
		$names = [
			'100' => 'Thin',
			'200' => 'Extra Light',
			'300' => 'Light',
			'400' => 'Regular',
			'500' => 'Medium',
			'600' => 'Semibold',
			'700' => 'Bold',
			'800' => 'Extra Bold',
			'900' => 'Black',
		];
		$lab = $names[ $weight ] ?? $weight;
		$italic = in_array( $style, [ 'italic', 'oblique' ], true );
		if ( $italic && '400' === $weight ) {
			return 'Italic';
		}
		return $italic ? ( $lab . ' Italic' ) : $lab;
	}

	private static function variants_from_faces( array $faces ): array {
		$out  = [];
		$seen = [];
		foreach ( $faces as $face ) {
			$w = trim( (string) ( $face['weight'] ?? '400' ) );
			$s = trim( (string) ( $face['style'] ?? 'normal' ) );
			if ( $w === '' ) {
				$w = '400';
			}
			if ( str_contains( $w, ' ' ) ) {
				return self::default_variants();
			}
			$id = $w . '-' . $s;
			if ( isset( $seen[ $id ] ) ) {
				continue;
			}
			$seen[ $id ] = true;
			$out[]       = [
				'id'     => $id,
				'label'  => self::variant_label( $w, $s ),
				'weight' => $w,
				'style'  => $s,
			];
		}
		return $out ?: self::default_variants();
	}

	private static function collect_families( array $nodes, array &$used ): void {
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			foreach ( $node['styles'] ?? [] as $bp ) {
				if ( is_array( $bp ) && ! empty( $bp['font-family'] ) ) {
					$used[] = (string) $bp['font-family'];
				}
			}
			if ( ! empty( $node['children'] ) && is_array( $node['children'] ) ) {
				self::collect_families( $node['children'], $used );
			}
		}
	}
}
