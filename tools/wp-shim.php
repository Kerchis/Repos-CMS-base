<?php
/**
 * Minimo de WordPress para los bancos de pruebas.
 *
 * Solo define lo que tocan el catalogo, el registro y el saneador. No es un
 * WordPress: lo que depende de la base de datos devuelve vacio a proposito.
 * Todo va protegido con function_exists para poder convivir con otros bancos.
 *
 * @package Meridian
 */

if ( ! function_exists( '__' ) ) {
	function __( $t, $d = '' ) { return $t; }
}
if ( ! function_exists( '_x' ) ) {
	function _x( $t, $c = '', $d = '' ) { return $t; }
}
if ( ! function_exists( 'esc_html__' ) ) {
	function esc_html__( $t, $d = '' ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_attr__' ) ) {
	function esc_attr__( $t, $d = '' ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $t ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $t ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_url' ) ) {
	function esc_url( $u ) { return htmlspecialchars( (string) $u, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $u ) { return (string) $u; }
}
if ( ! function_exists( 'absint' ) ) {
	function absint( $n ) { return abs( (int) $n ); }
}
if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $k ) { return strtolower( preg_replace( '/[^a-z0-9_\-]/i', '', (string) $k ) ); }
}
if ( ! function_exists( 'sanitize_html_class' ) ) {
	function sanitize_html_class( $c, $fallback = '' ) {
		$c = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $c );
		return '' === $c ? $fallback : $c;
	}
}
if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $t ) { return trim( strip_tags( (string) $t ) ); }
}
if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $t ) { return trim( strip_tags( (string) $t ) ); }
}
if ( ! function_exists( 'sanitize_email' ) ) {
	function sanitize_email( $t ) { return filter_var( (string) $t, FILTER_SANITIZE_EMAIL ); }
}
if ( ! function_exists( 'is_email' ) ) {
	function is_email( $t ) { return (bool) filter_var( (string) $t, FILTER_VALIDATE_EMAIL ); }
}
if ( ! function_exists( 'sanitize_title' ) ) {
	function sanitize_title( $t ) {
		$t = strtolower( trim( strip_tags( (string) $t ) ) );
		$t = strtr( $t, [ 'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u' ] );
		$t = preg_replace( '/[^a-z0-9]+/', '-', $t );
		return trim( (string) $t, '-' );
	}
}
if ( ! function_exists( 'sanitize_hex_color' ) ) {
	function sanitize_hex_color( $c ) {
		$c = trim( (string) $c );
		return preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $c ) ? $c : null;
	}
}
if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $t, $br = false ) { return trim( strip_tags( (string) $t ) ); }
}
if ( ! function_exists( 'wp_kses_post' ) ) {
	function wp_kses_post( $t ) { return (string) $t; }
}
if ( ! function_exists( 'wp_kses' ) ) {
	/**
	 * Filtro por lista blanca, de verdad.
	 *
	 * NO es el `wp_kses` de WordPress —ese tiene su propio analizador y
	 * mil casos de borde—, pero hace lo mismo que importa aqui: quita
	 * las etiquetas que no estan en la lista conservando su texto, borra
	 * los atributos que no estan permitidos, tira cualquier `on*` y
	 * rechaza los protocolos peligrosos de las URL.
	 *
	 * Antes devolvia el texto tal cual, asi que CUALQUIER prueba sobre
	 * el saneador daba verde sin sanear nada. Un banco que no filtra no
	 * mide nada.
	 */
	function wp_kses( $t, $allowed = [] ) {
		$t = (string) $t;
		if ( '' === trim( $t ) || ! class_exists( 'DOMDocument' ) ) {
			return $t;
		}
		$doc = new DOMDocument();
		libxml_use_internal_errors( true );
		$doc->loadHTML(
			'<?xml encoding="utf-8" ?><div id="krg-kses">' . $t . '</div>',
			LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
		);
		libxml_clear_errors();
		$raiz = $doc->getElementById( 'krg-kses' );
		if ( ! $raiz ) {
			return $t;
		}
		krg_kses_limpia( $raiz, is_array( $allowed ) ? $allowed : [] );
		$salida = '';
		foreach ( $raiz->childNodes as $hijo ) {
			$salida .= $doc->saveHTML( $hijo );
		}
		return $salida;
	}

	function krg_kses_limpia( DOMNode $nodo, array $allowed ): void {
		foreach ( iterator_to_array( $nodo->childNodes ) as $hijo ) {
			if ( XML_COMMENT_NODE === $hijo->nodeType ) {
				$nodo->removeChild( $hijo );
				continue;
			}
			if ( XML_ELEMENT_NODE !== $hijo->nodeType ) {
				continue;
			}
			// Primero por dentro: asi lo que se suba al quitar una
			// etiqueta ya viene limpio.
			krg_kses_limpia( $hijo, $allowed );
			$tag = strtolower( $hijo->nodeName );
			if ( ! array_key_exists( $tag, $allowed ) ) {
				// Como kses: fuera la etiqueta, dentro se queda el texto.
				while ( $hijo->firstChild ) {
					$nodo->insertBefore( $hijo->firstChild, $hijo );
				}
				$nodo->removeChild( $hijo );
				continue;
			}
			$permitidos = is_array( $allowed[ $tag ] ) ? $allowed[ $tag ] : [];
			foreach ( iterator_to_array( $hijo->attributes ) as $attr ) {
				$nombre = strtolower( $attr->nodeName );
				if ( str_starts_with( $nombre, 'on' ) || empty( $permitidos[ $nombre ] ) ) {
					$hijo->removeAttribute( $attr->nodeName );
					continue;
				}
				if ( in_array( $nombre, [ 'href', 'src', 'srcset', 'cite', 'action' ], true )
					&& preg_match( '#^\s*(javascript|vbscript|data)\s*:#i', (string) $attr->nodeValue ) ) {
					$hijo->removeAttribute( $attr->nodeName );
				}
			}
		}
	}
}
if ( ! function_exists( 'wp_parse_args' ) ) {
	function wp_parse_args( $a, $b = [] ) { return array_merge( (array) $b, (array) $a ); }
}
// Como en WordPress: lo que entra por la peticion llega con barras y las
// metas se guardan con barras. Si el banco no lo imita, el viaje de ida y
// vuelta de un documento se prueba mas facil de lo que es en realidad.
if ( ! function_exists( 'stripslashes_deep' ) ) {
	function stripslashes_deep( $v ) {
		if ( is_array( $v ) ) {
			return array_map( 'stripslashes_deep', $v );
		}
		return is_string( $v ) ? stripslashes( $v ) : $v;
	}
}
if ( ! function_exists( 'wp_unslash' ) ) {
	function wp_unslash( $v ) { return stripslashes_deep( $v ); }
}
if ( ! function_exists( 'wp_slash' ) ) {
	function wp_slash( $v ) {
		if ( is_array( $v ) ) {
			return array_map( 'wp_slash', $v );
		}
		return is_string( $v ) ? addslashes( $v ) : $v;
	}
}
if ( ! function_exists( 'wp_unique_id' ) ) {
	function wp_unique_id( $p = '' ) { static $i = 0; return $p . ( ++$i ); }
}
if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $d, $f = 0 ) { return json_encode( $d, $f ); }
}
if ( ! function_exists( 'wp_rand' ) ) {
	function wp_rand( $min = 0, $max = 0 ) { return $min; }
}
if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $tag, $value, ...$rest ) { return $value; }
}
if ( ! function_exists( 'do_action' ) ) {
	function do_action( ...$a ) {}
}
if ( ! function_exists( 'add_action' ) ) {
	function add_action( ...$a ) {}
}
if ( ! function_exists( 'add_filter' ) ) {
	function add_filter( ...$a ) {}
}
if ( ! function_exists( 'get_option' ) ) {
	/**
	 * Lee de verdad lo que haya escrito `update_option()`.
	 *
	 * Devolvia siempre el valor por defecto, asi que ninguna prueba
	 * podia montar un escenario «esta instalacion tiene esto guardado»
	 * —justo lo que hace falta para reproducir un token a cero.
	 */
	function get_option( $k, $d = false ) {
		return array_key_exists( $k, $GLOBALS['krg_options'] ?? [] ) ? $GLOBALS['krg_options'][ $k ] : $d;
	}
}
if ( ! function_exists( 'home_url' ) ) {
	function home_url( $p = '/' ) { return 'https://ejemplo.test' . $p; }
}
if ( ! function_exists( 'site_url' ) ) {
	function site_url( $p = '/' ) { return 'https://ejemplo.test' . $p; }
}
if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $u, $c = -1 ) { return parse_url( (string) $u, $c ); }
}
if ( ! function_exists( 'wp_allowed_protocols' ) ) {
	function wp_allowed_protocols() { return [ 'http', 'https', 'mailto', 'tel' ]; }
}
if ( ! function_exists( 'post_type_exists' ) ) {
	function post_type_exists( $t ) { return false; }
}
if ( ! function_exists( 'shortcode_exists' ) ) {
	function shortcode_exists( $t ) { return false; }
}
if ( ! function_exists( 'get_posts' ) ) {
	function get_posts( $a = [] ) { return []; }
}
if ( ! function_exists( 'get_pages' ) ) {
	function get_pages( $a = [] ) { return []; }
}
if ( ! function_exists( 'wp_get_nav_menus' ) ) {
	function wp_get_nav_menus( $a = [] ) { return []; }
}
if ( ! function_exists( 'get_categories' ) ) {
	/**
	 * Las categorias que el banco haya puesto en `$GLOBALS['krg_categorias']`.
	 *
	 * Antes devolvia siempre una lista vacia, asi que el modulo de
	 * categorias no pintaba nada ni con el interruptor encendido y
	 * cualquier prueba sobre el daba verde por el motivo equivocado.
	 */
	function get_categories( $a = [] ) {
		return is_array( $GLOBALS['krg_categorias'] ?? null ) ? $GLOBALS['krg_categorias'] : [];
	}
}
if ( ! function_exists( 'get_category_link' ) ) {
	function get_category_link( $c ) {
		$slug = is_object( $c ) ? ( $c->slug ?? '' ) : (string) $c;
		return 'https://krg.test/category/' . $slug . '/';
	}
}
if ( ! function_exists( 'is_category' ) ) {
	function is_category( $x = '' ) { return ! empty( $GLOBALS['krg_es_categoria'] ); }
}
if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( ...$a ) { return ''; }
}
// Imagenes de la mediateca. Sin esto cualquier banco que use un plato
// con foto muere con «undefined function», que es justo la clase de
// hueco que hace que una prueba mida una pagina que no existe.
if ( ! function_exists( 'wp_get_attachment_image_url' ) ) {
	function wp_get_attachment_image_url( $id, $size = 'thumbnail', $icon = false ) {
		$id = (int) $id;
		return $id ? 'https://ejemplo.test/uploads/foto-' . $id . '-' . (string) ( is_array( $size ) ? 'custom' : $size ) . '.jpg' : '';
	}
}
if ( ! function_exists( 'wp_get_attachment_image' ) ) {
	function wp_get_attachment_image( $id, $size = 'thumbnail', $icon = false, $attr = [] ) {
		$id = (int) $id;
		if ( ! $id ) {
			return '';
		}
		$attr['src'] = wp_get_attachment_image_url( $id, $size );
		$attr['alt'] = (string) ( $attr['alt'] ?? '' );
		$out         = '';
		foreach ( $attr as $k => $v ) {
			if ( '' === $v && 'alt' !== $k ) {
				continue;
			}
			$out .= ' ' . $k . '="' . esc_attr( (string) $v ) . '"';
		}
		return '<img' . $out . ' width="1200" height="800">';
	}
}
if ( ! function_exists( 'number_format_i18n' ) ) {
	function number_format_i18n( $n, $d = 0 ) { return number_format( (float) $n, (int) $d ); }
}
if ( ! function_exists( 'get_template_directory' ) ) {
	function get_template_directory() { return dirname( __DIR__ ) . '/krg-cms'; }
}
if ( ! function_exists( 'get_template_directory_uri' ) ) {
	function get_template_directory_uri() { return 'https://ejemplo.test/wp-content/themes/krg-cms'; }
}
if ( ! function_exists( 'update_option' ) ) {
	function update_option( $k, $v, $a = null ) { $GLOBALS['krg_options'][ $k ] = $v; return true; }
}
if ( ! function_exists( 'add_option' ) ) {
	function add_option( $k, $v = '', $d = '', $a = 'yes' ) { return update_option( $k, $v ); }
}
if ( ! function_exists( 'delete_option' ) ) {
	function delete_option( $k ) { unset( $GLOBALS['krg_options'][ $k ] ); return true; }
}
if ( ! function_exists( 'get_transient' ) ) {
	function get_transient( $k ) { return false; }
}
if ( ! function_exists( 'set_transient' ) ) {
	function set_transient( $k, $v, $t = 0 ) { return true; }
}
if ( ! function_exists( 'delete_transient' ) ) {
	function delete_transient( $k ) { return true; }
}
defined( 'MINUTE_IN_SECONDS' ) || define( 'MINUTE_IN_SECONDS', 60 );
defined( 'HOUR_IN_SECONDS' ) || define( 'HOUR_IN_SECONDS', 3600 );
defined( 'DAY_IN_SECONDS' ) || define( 'DAY_IN_SECONDS', 86400 );
if ( ! function_exists( 'wp_cache_delete' ) ) {
	function wp_cache_delete( $k, $g = '' ) { return true; }
}
if ( ! function_exists( 'wp_cache_flush' ) ) {
	function wp_cache_flush() { return true; }
}
if ( ! function_exists( 'trailingslashit' ) ) {
	function trailingslashit( $s ) { return rtrim( (string) $s, '/\\' ) . '/'; }
}
if ( ! function_exists( 'untrailingslashit' ) ) {
	function untrailingslashit( $s ) { return rtrim( (string) $s, '/\\' ); }
}
if ( ! function_exists( 'wp_normalize_path' ) ) {
	function wp_normalize_path( $p ) { return str_replace( '\\', '/', (string) $p ); }
}

if ( ! function_exists( 'wp_generate_uuid4' ) ) {
	function wp_generate_uuid4() {
		return sprintf(
			'%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
			wp_rand( 0, 0xffff ), wp_rand( 0, 0xffff ),
			wp_rand( 0, 0xffff ),
			wp_rand( 0, 0x0fff ) | 0x4000,
			wp_rand( 0, 0x3fff ) | 0x8000,
			wp_rand( 0, 0xffff ), wp_rand( 0, 0xffff ), wp_rand( 0, 0xffff )
		);
	}
}
if ( ! function_exists( 'wp_rand' ) ) {
	function wp_rand( $min = 0, $max = 0 ) {
		return random_int( (int) $min, (int) $max );
	}
}

if ( ! function_exists( 'wp_nonce_field' ) ) {
	function wp_nonce_field( $action = -1, $name = '_wpnonce', $referer = true, $display = true ) {
		$html = '<input type="hidden" name="' . $name . '" value="banco">';
		if ( $display ) {
			echo $html; // phpcs:ignore
		}
		return $html;
	}
}

/* ---------------------------------------------------------------- */
/* Entradas del blog                                                 */
/*                                                                    */
/* Lo justo para que las rejillas de entradas se puedan pintar fuera  */
/* de WordPress: las entradas las pone el banco en                    */
/* `$GLOBALS['krg_entradas']` como objetos con id, titulo, fecha,     */
/* extracto y miniatura.                                              */
/* ---------------------------------------------------------------- */
if ( ! class_exists( 'WP_Post' ) ) {
	class WP_Post {
		public $ID            = 0;
		public $post_title    = '';
		public $post_excerpt  = '';
		public $post_date     = '';
		public $post_name     = '';
		public $post_status   = 'publish';
		public $post_type     = 'post';
		public $thumbnail_id  = 0;

		public function __construct( array $datos = [] ) {
			foreach ( $datos as $k => $v ) {
				$this->$k = $v;
			}
		}
	}
}
if ( ! class_exists( 'WP_Query' ) ) {
	class WP_Query {
		public $posts = [];

		public function __construct( $args = [] ) {
			$todas       = is_array( $GLOBALS['krg_entradas'] ?? null ) ? $GLOBALS['krg_entradas'] : [];
			$cuantas     = (int) ( $args['posts_per_page'] ?? 10 );
			$this->posts = $cuantas > 0 ? array_slice( $todas, 0, $cuantas ) : $todas;
		}

		public function have_posts() {
			return (bool) $this->posts;
		}
	}
}
if ( ! function_exists( 'wp_reset_postdata' ) ) {
	function wp_reset_postdata() {}
}
if ( ! function_exists( 'get_the_title' ) ) {
	function get_the_title( $p = null ) { return is_object( $p ) ? (string) $p->post_title : ''; }
}
if ( ! function_exists( 'get_permalink' ) ) {
	function get_permalink( $p = null ) {
		$slug = is_object( $p ) ? ( $p->post_name ?: 'entrada-' . $p->ID ) : '';
		return 'https://krg.test/' . $slug . '/';
	}
}
if ( ! function_exists( 'get_the_date' ) ) {
	function get_the_date( $f = '', $p = null ) { return is_object( $p ) ? (string) $p->post_date : ''; }
}
if ( ! function_exists( 'get_the_excerpt' ) ) {
	function get_the_excerpt( $p = null ) { return is_object( $p ) ? (string) $p->post_excerpt : ''; }
}
if ( ! function_exists( 'get_post_thumbnail_id' ) ) {
	function get_post_thumbnail_id( $p = null ) { return is_object( $p ) ? (int) $p->thumbnail_id : 0; }
}
if ( ! function_exists( 'wp_trim_words' ) ) {
	function wp_trim_words( $t, $n = 55, $mas = null ) {
		$palabras = preg_split( '/\s+/', trim( (string) $t ) );
		if ( count( $palabras ) <= $n ) {
			return (string) $t;
		}
		return implode( ' ', array_slice( $palabras, 0, $n ) ) . ( null === $mas ? '…' : $mas );
	}
}
if ( ! function_exists( 'wp_get_post_categories' ) ) {
	function wp_get_post_categories( $id, $args = [] ) { return []; }
}
