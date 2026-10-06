<?php
/**
 * Revision de una pagina antes de publicarla.
 *
 * Avisa, no bloquea. Nadie quiere un CMS que le diga que no puede
 * publicar; lo que hace falta es que, justo antes de darle al boton,
 * alguien repase en dos segundos lo que a una persona se le pasa: una
 * foto sin texto alternativo, dos titulares de primer nivel, un fondo
 * sobre el que el texto no se lee, una foto de tres megas y la pagina
 * sin descripcion para los buscadores.
 *
 * Todo se mira en el servidor porque es donde estan los datos: el alto
 * y el peso de cada foto y su texto alternativo viven en la Biblioteca
 * de WordPress, y el color real de un token, en la paleta activa. El
 * panel solo pinta la lista.
 *
 * Cada hallazgo lleva:
 *
 *   level   `aviso` (conviene arreglarlo) o `pista` (podria mejorarse)
 *   code    de que clase es, para agrupar
 *   nodeId  el bloque culpable, si lo hay, para poder ir hasta el
 *   title   una linea
 *   detail  por que importa, en cristiano
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

use Meridian\Components\Registry;
use Meridian\Design\Contrast;

class PageReview {

	/** Relacion de contraste minima para texto normal (WCAG AA). */
	private const CONTRASTE_MINIMO = 4.5;

	/** A partir de aqui una foto pesa de mas, en bytes. */
	private const PESO_AVISO = 600000;
	private const PESO_PISTA = 300000;

	/** Largos razonables para buscadores. */
	private const SEO_TITULO_MAX = 60;
	private const SEO_DESC_MIN   = 70;
	private const SEO_DESC_MAX   = 160;

	/**
	 * Revisa un documento y devuelve lo que convendria mirar.
	 *
	 * @param array $doc Documento de pagina, ya saneado.
	 * @return array{items:array,counts:array}
	 */
	public static function run( array $doc ): array {
		$items = [];
		$nodos = self::aplanar( $doc['sections'] ?? [] );

		self::revisar_titulares( $nodos, $items );
		self::revisar_imagenes( $nodos, $items );
		self::revisar_contraste( $nodos, $items );
		self::revisar_enlaces( $nodos, $items );
		self::revisar_vacias( $doc['sections'] ?? [], $items );
		self::revisar_seo( $doc, $items );

		$counts = [
			'aviso' => 0,
			'pista' => 0,
		];
		foreach ( $items as $i ) {
			++$counts[ $i['level'] ];
		}
		return [
			'items'  => $items,
			'counts' => $counts,
		];
	}

	/* ---------------------------------------------------------------- */

	/** Todos los bloques del documento en una lista plana, con su camino. */
	private static function aplanar( array $nodes, array $padres = [] ): array {
		$out = [];
		foreach ( $nodes as $n ) {
			if ( ! is_array( $n ) ) {
				continue;
			}
			// Un bloque oculto no se pinta en la web: no se revisa, que
			// avisar de lo que no se ve solo hace ruido.
			if ( array_key_exists( 'visible', $n ) && ! $n['visible'] ) {
				continue;
			}
			$out[] = [
				'node'   => $n,
				'padres' => $padres,
			];
			if ( ! empty( $n['children'] ) && is_array( $n['children'] ) ) {
				$out = array_merge( $out, self::aplanar( $n['children'], array_merge( $padres, [ $n ] ) ) );
			}
		}
		return $out;
	}

	private static function nombre( array $n ): string {
		$nombre = trim( (string) ( $n['name'] ?? '' ) );
		if ( '' !== $nombre ) {
			return $nombre;
		}
		$def = Registry::get( (string) ( $n['type'] ?? '' ) );
		return $def['name'] ?? (string) ( $n['type'] ?? 'bloque' );
	}

	private static function add( array &$items, string $level, string $code, string $node_id, string $title, string $detail ): void {
		$items[] = [
			'level'  => $level,
			'code'   => $code,
			'nodeId' => $node_id,
			'title'  => $title,
			'detail' => $detail,
		];
	}

	/* ---------------------------------------------------------------- */

	/**
	 * Un solo titular de primer nivel por pagina.
	 *
	 * Ninguno y el buscador no sabe de que va la pagina; dos y deja de
	 * saberlo tambien quien navega con lector de pantalla.
	 */
	private static function revisar_titulares( array $nodos, array &$items ): void {
		$h1 = [];
		foreach ( $nodos as $x ) {
			foreach ( self::etiquetas_de( $x['node'] ) as $tag ) {
				if ( 'h1' === $tag ) {
					$h1[] = $x['node'];
				}
			}
		}
		if ( ! $h1 ) {
			self::add(
				$items,
				'aviso',
				'h1',
				'',
				__( 'La página no tiene titular de primer nivel', 'meridian' ),
				__( 'El H1 es el que dice de qué va la página. Pon en H1 el titular principal desde su pestaña «Contenido».', 'meridian' )
			);
			return;
		}
		if ( count( $h1 ) > 1 ) {
			foreach ( array_slice( $h1, 1 ) as $n ) {
				self::add(
					$items,
					'aviso',
					'h1',
					(string) ( $n['id'] ?? '' ),
					sprintf(
						/* translators: %s: nombre del bloque. */
						__( '«%s» es otro titular de primer nivel', 'meridian' ),
						self::nombre( $n )
					),
					sprintf(
						/* translators: %d: cuantos H1 hay. */
						__( 'Hay %d en la página. Deja uno solo en H1 y baja los demás a H2 o H3: así se entiende cuál manda.', 'meridian' ),
						count( $h1 )
					)
				);
			}
		}
	}

	/** Las etiquetas de titular que lleva un bloque (`tag`, `titleTag`…). */
	private static function etiquetas_de( array $n ): array {
		$out = [];
		foreach ( (array) ( $n['props'] ?? [] ) as $k => $v ) {
			if ( ! is_string( $v ) ) {
				continue;
			}
			if ( preg_match( '/tag$/i', (string) $k ) && preg_match( '/^h[1-6]$/i', $v ) ) {
				$out[] = strtolower( $v );
			}
		}
		return $out;
	}

	/* ---------------------------------------------------------------- */

	/**
	 * Fotos: texto alternativo y peso.
	 *
	 * El texto alternativo puede estar en el bloque —los que tienen el
	 * campo— o en la Biblioteca, que es de donde lo saca el tema cuando
	 * el bloque no lo trae. Se mira en los dos sitios antes de avisar.
	 */
	private static function revisar_imagenes( array $nodos, array &$items ): void {
		foreach ( $nodos as $x ) {
			$n    = $x['node'];
			$tipo = (string) ( $n['type'] ?? '' );
			$def  = Registry::get( $tipo );
			if ( ! $def ) {
				continue;
			}
			foreach ( self::imagenes_de( $def['fields'] ?? [], (array) ( $n['props'] ?? [] ) ) as $img ) {
				$id = (int) $img['id'];
				if ( ! $id ) {
					continue;
				}
				$alt = trim( (string) $img['alt'] );
				if ( '' === $alt ) {
					$alt = trim( (string) get_post_meta( $id, '_wp_attachment_image_alt', true ) );
				}
				if ( '' === $alt ) {
					self::add(
						$items,
						'aviso',
						'alt',
						(string) ( $n['id'] ?? '' ),
						sprintf(
							/* translators: %s: nombre del bloque. */
							__( 'Una foto de «%s» no tiene texto alternativo', 'meridian' ),
							self::nombre( $n )
						),
						__( 'El texto alternativo es lo que lee en voz alta un lector de pantalla y lo que se ve si la foto no carga. Escríbelo en el bloque o en la Biblioteca de medios.', 'meridian' )
					);
				}
				$peso = self::peso_de( $id );
				if ( $peso >= self::PESO_AVISO ) {
					self::add(
						$items,
						'aviso',
						'peso',
						(string) ( $n['id'] ?? '' ),
						sprintf(
							/* translators: 1: nombre del bloque, 2: peso. */
							__( 'Una foto de «%1$s» pesa %2$s', 'meridian' ),
							self::nombre( $n ),
							size_format( $peso )
						),
						__( 'Por encima de medio mega la página tarda en abrir en un móvil con datos. Vuelve a guardarla más pequeña o súbela otra vez a menos resolución.', 'meridian' )
					);
				} elseif ( $peso >= self::PESO_PISTA ) {
					self::add(
						$items,
						'pista',
						'peso',
						(string) ( $n['id'] ?? '' ),
						sprintf(
							/* translators: 1: nombre del bloque, 2: peso. */
							__( 'Una foto de «%1$s» pesa %2$s', 'meridian' ),
							self::nombre( $n ),
							size_format( $peso )
						),
						__( 'No es grave, pero si la vuelves a guardar más ligera la página abre antes.', 'meridian' )
					);
				}
			}
		}
	}

	/**
	 * Las fotos de un bloque, bajando también por los repetidores.
	 *
	 * Devuelve pares de id y texto alternativo: el campo `alt` que haya
	 * al lado de la foto, si el bloque lo tiene.
	 */
	private static function imagenes_de( array $fields, array $props ): array {
		$out = [];
		foreach ( $fields as $f ) {
			$key  = (string) ( $f['key'] ?? '' );
			$tipo = (string) ( $f['type'] ?? '' );
			if ( 'image' === $tipo && ! empty( $props[ $key ] ) ) {
				$out[] = [
					'id'  => (int) $props[ $key ],
					'alt' => self::alt_vecino( $fields, $props, $key ),
				];
			}
			if ( 'repeater' === $tipo && ! empty( $props[ $key ] ) && is_array( $props[ $key ] ) ) {
				// Los sub-campos del repetidor van en `itemFields`.
				$sub = (array) ( $f['itemFields'] ?? $f['fields'] ?? [] );
				foreach ( $props[ $key ] as $fila ) {
					if ( is_array( $fila ) ) {
						$out = array_merge( $out, self::imagenes_de( $sub, $fila ) );
					}
				}
			}
		}
		return $out;
	}

	/** El campo de texto alternativo que acompaña a una foto, si existe. */
	private static function alt_vecino( array $fields, array $props, string $image_key ): string {
		$candidatos = [ 'alt', $image_key . 'Alt', str_replace( 'Id', 'Alt', $image_key ) ];
		foreach ( $fields as $f ) {
			$k = (string) ( $f['key'] ?? '' );
			if ( in_array( $k, $candidatos, true ) && isset( $props[ $k ] ) ) {
				return (string) $props[ $k ];
			}
		}
		return '';
	}

	/** Lo que ocupa un adjunto en disco, en bytes. */
	private static function peso_de( int $id ): int {
		$meta = wp_get_attachment_metadata( $id );
		if ( is_array( $meta ) && ! empty( $meta['filesize'] ) ) {
			return (int) $meta['filesize'];
		}
		$ruta = get_attached_file( $id );
		if ( $ruta && file_exists( $ruta ) ) {
			return (int) filesize( $ruta );
		}
		return 0;
	}

	/* ---------------------------------------------------------------- */

	/**
	 * Contraste del texto sobre los fondos que se han puesto a mano.
	 *
	 * Solo se miran los fondos escritos en el inspector: los de la
	 * paleta ya vienen pensados. Se compara con el color de texto de la
	 * marca, que es el que hereda lo que haya dentro.
	 */
	private static function revisar_contraste( array $nodos, array &$items ): void {
		$texto = Contrast::token_hex( 'color.text' );
		if ( '' === $texto ) {
			return;
		}
		foreach ( $nodos as $x ) {
			$n = $x['node'];
			foreach ( (array) ( $n['styles'] ?? [] ) as $bp => $caja ) {
				if ( ! is_array( $caja ) || empty( $caja['background-color'] ) ) {
					continue;
				}
				$fondo = Contrast::resolve_hex( $caja['background-color'] );
				if ( '' === $fondo ) {
					continue;
				}
				$ratio = Contrast::ratio( $texto, $fondo );
				if ( $ratio >= self::CONTRASTE_MINIMO ) {
					continue;
				}
				self::add(
					$items,
					'aviso',
					'contraste',
					(string) ( $n['id'] ?? '' ),
					sprintf(
						/* translators: 1: nombre del bloque, 2: relacion de contraste, 3: tamaño. */
						__( 'En «%1$s» el texto queda a %2$s sobre su fondo (%3$s)', 'meridian' ),
						self::nombre( $n ),
						number_format_i18n( $ratio, 1 ) . ':1',
						self::nombre_bp( (string) $bp )
					),
					sprintf(
						/* translators: %s: relacion minima. */
						__( 'Para leerse bien hacen falta %s. Aclara el fondo, oscurece el texto o usa uno de los temas de la paleta, que ya vienen con el contraste resuelto.', 'meridian' ),
						number_format_i18n( self::CONTRASTE_MINIMO, 1 ) . ':1'
					)
				);
			}
		}
	}

	private static function nombre_bp( string $bp ): string {
		$map = [
			'desktop' => __( 'escritorio', 'meridian' ),
			'tablet'  => __( 'tableta', 'meridian' ),
			'mobile'  => __( 'móvil', 'meridian' ),
		];
		return $map[ $bp ] ?? $bp;
	}

	/* ---------------------------------------------------------------- */

	/** Botones y enlaces que no llevan a ninguna parte. */
	private static function revisar_enlaces( array $nodos, array &$items ): void {
		foreach ( $nodos as $x ) {
			$n     = $x['node'];
			$props = (array) ( $n['props'] ?? [] );
			if ( ! in_array( (string) ( $n['type'] ?? '' ), [ 'button', 'button-group' ], true ) ) {
				continue;
			}
			$urls = [];
			if ( array_key_exists( 'url', $props ) ) {
				$urls[] = (string) $props['url'];
			}
			// El grupo de botones guarda su lista en `buttons`, no en
			// `items`: se miran todas las listas de filas que tenga.
			foreach ( $props as $v ) {
				if ( ! is_array( $v ) ) {
					continue;
				}
				foreach ( $v as $fila ) {
					if ( is_array( $fila ) && array_key_exists( 'url', $fila ) ) {
						$urls[] = (string) $fila['url'];
					}
				}
			}
			foreach ( $urls as $u ) {
				$u = trim( $u );
				if ( '' === $u || '#' === $u ) {
					self::add(
						$items,
						'pista',
						'enlace',
						(string) ( $n['id'] ?? '' ),
						sprintf(
							/* translators: %s: nombre del bloque. */
							__( '«%s» no lleva a ninguna parte', 'meridian' ),
							self::nombre( $n )
						),
						__( 'El botón se pinta, pero al pulsarlo no pasa nada. Escribe su dirección o quítalo.', 'meridian' )
					);
					break;
				}
			}
		}
	}

	/* ---------------------------------------------------------------- */

	/** Secciones que no van a verse: en la web ocupan cero. */
	private static function revisar_vacias( array $sections, array &$items ): void {
		foreach ( $sections as $s ) {
			if ( ! is_array( $s ) ) {
				continue;
			}
			if ( self::tiene_algo( $s ) ) {
				continue;
			}
			self::add(
				$items,
				'pista',
				'vacia',
				(string) ( $s['id'] ?? '' ),
				sprintf(
					/* translators: %s: nombre de la seccion. */
					__( '«%s» está vacía y no se verá', 'meridian' ),
					self::nombre( $s )
				),
				__( 'Una sección sin nada dentro ocupa cero en la web, aunque en el editor se vea. Ponle contenido o bórrala.', 'meridian' )
			);
		}
	}

	/** ¿Hay algún bloque de verdad dentro, bajando por filas y columnas? */
	private static function tiene_algo( array $n ): bool {
		$tipo = (string) ( $n['type'] ?? '' );
		if ( ! in_array( $tipo, [ 'section', 'row', 'column', 'container', 'columns' ], true ) ) {
			return true;
		}
		foreach ( (array) ( $n['children'] ?? [] ) as $h ) {
			if ( is_array( $h ) && self::tiene_algo( $h ) ) {
				return true;
			}
		}
		return false;
	}

	/* ---------------------------------------------------------------- */

	/** Lo que mira un buscador y lo que se ve al compartir el enlace. */
	private static function revisar_seo( array $doc, array &$items ): void {
		$seo   = (array) ( $doc['seo'] ?? [] );
		$desc  = trim( (string) ( $seo['description'] ?? '' ) );
		$tit   = trim( (string) ( $seo['title'] ?? '' ) );
		$largo = function_exists( 'mb_strlen' ) ? 'mb_strlen' : 'strlen';

		if ( '' === $desc ) {
			self::add(
				$items,
				'aviso',
				'seo',
				'',
				__( 'La página no tiene descripción para buscadores', 'meridian' ),
				__( 'Sin ella, Google se inventa el resumen con el primer texto que encuentre. Escríbela en «Configuración de página» → SEO, en una o dos frases.', 'meridian' )
			);
		} elseif ( $largo( $desc ) > self::SEO_DESC_MAX ) {
			self::add(
				$items,
				'pista',
				'seo',
				'',
				sprintf(
					/* translators: %d: numero de caracteres. */
					__( 'La descripción para buscadores tiene %d caracteres', 'meridian' ),
					$largo( $desc )
				),
				sprintf(
					/* translators: %d: numero de caracteres. */
					__( 'A partir de %d se corta con puntos suspensivos. Lo importante, al principio.', 'meridian' ),
					self::SEO_DESC_MAX
				)
			);
		} elseif ( $largo( $desc ) < self::SEO_DESC_MIN ) {
			self::add(
				$items,
				'pista',
				'seo',
				'',
				__( 'La descripción para buscadores se queda muy corta', 'meridian' ),
				sprintf(
					/* translators: 1: caracteres actuales, 2: minimo recomendado. */
					__( 'Tiene %1$d caracteres y caben unos %2$d. Es el anuncio de la página en Google: aprovéchalo.', 'meridian' ),
					$largo( $desc ),
					self::SEO_DESC_MAX
				)
			);
		}

		if ( '' !== $tit && $largo( $tit ) > self::SEO_TITULO_MAX ) {
			self::add(
				$items,
				'pista',
				'seo',
				'',
				sprintf(
					/* translators: %d: numero de caracteres. */
					__( 'El título para buscadores tiene %d caracteres', 'meridian' ),
					$largo( $tit )
				),
				sprintf(
					/* translators: %d: numero de caracteres. */
					__( 'Por encima de %d Google lo corta. Pon delante lo que distingue a esta página.', 'meridian' ),
					self::SEO_TITULO_MAX
				)
			);
		}

		$robots = (string) ( $seo['robots'] ?? 'index,follow' );
		if ( false !== strpos( $robots, 'noindex' ) ) {
			self::add(
				$items,
				'aviso',
				'seo',
				'',
				__( 'Esta página está marcada para no salir en buscadores', 'meridian' ),
				__( 'En «Robots» pone «noindex». Si la página es pública, cámbialo a «index,follow».', 'meridian' )
			);
		}

		if ( empty( $seo['ogImageId'] ) ) {
			self::add(
				$items,
				'pista',
				'seo',
				'',
				__( 'Al compartir el enlace no saldrá ninguna foto', 'meridian' ),
				__( 'Elige una imagen Open Graph en «Configuración de página» → SEO y el enlace se verá con foto en WhatsApp y en redes.', 'meridian' )
			);
		}

		$slug = trim( (string) ( $doc['slug'] ?? '' ) );
		if ( '' === $slug || preg_match( '/^(pagina|page)(-sin-titulo)?(-\d+)?$/', $slug ) ) {
			self::add(
				$items,
				'pista',
				'seo',
				'',
				sprintf(
					/* translators: %s: slug actual. */
					__( 'La dirección de la página sigue siendo «%s»', 'meridian' ),
					'' === $slug ? '—' : $slug
				),
				__( 'La dirección sale en Google y se comparte por ahí. Ponle una con las palabras de la página.', 'meridian' )
			);
		}
	}
}
