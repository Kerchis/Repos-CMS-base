<?php
/**
 * Llevarse el diseno de un sitio a otro.
 *
 * Un paquete es un JSON con cuatro cosas que se eligen por separado:
 *
 *   tokens     la paleta, las tipografias y las medidas;
 *   chrome     la cabecera, el pie y los menus;
 *   biblioteca las plantillas y los componentes globales;
 *   paginas    las paginas enteras.
 *
 * Lo que de verdad cuesta no es copiar el JSON: es que al llegar al
 * otro sitio los enlaces sigan llevando a alguna parte. Los
 * identificadores de pagina no coinciden entre dos instalaciones, asi
 * que un boton que apuntaba a la pagina 42 del origen apuntaria aqui a
 * cualquier cosa. Por eso el paquete lleva, ademas del contenido, el
 * dominio de donde salio y la lista de «identificador → direccion» de
 * sus paginas, y al importar se reconecta todo **por slug**: el enlace
 * a `/contacto` del origen acaba en la pagina `contacto` de aqui, sea
 * cual sea su identificador. Lo que no encuentra destino se deja como
 * estaba y se cuenta en el informe, que es mejor que inventarselo.
 *
 * Las fotos no viajan: un identificador de la Biblioteca del origen no
 * significa nada aqui. Se cuentan y se avisa (el kit con imagenes
 * dentro es otra cosa, y va aparte).
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

use Meridian\Components\Registry;
use Meridian\Design\TokenRepository;
use Meridian\Navigation\Menus;

class DesignKit {

	/** Las partes que se pueden elegir, en el orden en que se cuentan. */
	public const PARTES = [ 'tokens', 'chrome', 'biblioteca', 'paginas' ];

	/** Que hacer con una pagina cuyo slug ya existe aqui. */
	public const MODOS = [ 'crear', 'reemplazar', 'saltar' ];

	/* ---------------------------------------------------------------- */
	/* Exportar                                                          */

	/**
	 * Arma el paquete con las partes pedidas.
	 *
	 * @param array $opts ['tokens'=>bool,'chrome'=>bool,'biblioteca'=>bool,'paginas'=>bool,'pageIds'=>int[]]
	 */
	public static function export( array $opts = [] ): array {
		$quiere = static fn( string $k ): bool => ! array_key_exists( $k, $opts ) || ! empty( $opts[ $k ] );

		$pack = [
			'krg'        => 2,
			'exportedAt' => gmdate( 'c' ),
			'origen'     => [
				'home'   => home_url( '/' ),
				'nombre' => get_bloginfo( 'name' ),
			],
		];

		if ( $quiere( 'tokens' ) ) {
			$pack['tokens'] = TokenRepository::get();
		}
		if ( $quiere( 'chrome' ) ) {
			$pack['header'] = Menus::header();
			$pack['footer'] = Menus::footer();
			$pack['menus']  = Menus::all();
		}
		if ( $quiere( 'biblioteca' ) ) {
			$pack['templates'] = GlobalsRepository::list( 'meridian_template' );
			$pack['globals']   = GlobalsRepository::list( 'meridian_global' );
		}
		if ( $quiere( 'paginas' ) ) {
			$solo  = array_filter( array_map( 'absint', (array) ( $opts['pageIds'] ?? [] ) ) );
			$pages = [];
			$mapa  = [];
			foreach ( PageRepository::list() as $resumen ) {
				$pid = (int) $resumen['id'];
				if ( $solo && ! in_array( $pid, $solo, true ) ) {
					continue;
				}
				$doc = PageRepository::get( $pid, 'published' ) ?: PageRepository::get( $pid, 'draft' );
				if ( ! $doc ) {
					continue;
				}
				unset( $doc['previewUrl'], $doc['publicUrl'] );
				$pages[]       = $doc;
				$mapa[ $pid ]  = (string) ( $doc['slug'] ?? '' );
			}
			$pack['pages'] = $pages;
			// La libreta de direcciones: de que identificador salia cada
			// pagina y con que slug. Es lo que permite reconectar.
			$pack['paginasPorId'] = $mapa;
		}

		$pack['resumen'] = self::inspect( $pack );
		return $pack;
	}

	/* ---------------------------------------------------------------- */
	/* Mirar que trae un paquete, sin tocar nada                         */

	public static function inspect( array $pack ): array {
		return [
			'origen'     => (string) ( $pack['origen']['home'] ?? '' ),
			'fecha'      => (string) ( $pack['exportedAt'] ?? '' ),
			'tokens'     => ! empty( $pack['tokens'] ),
			'chrome'     => ! empty( $pack['header'] ) || ! empty( $pack['footer'] ) || ! empty( $pack['menus'] ),
			'menus'      => count( (array) ( $pack['menus'] ?? [] ) ),
			'plantillas' => count( (array) ( $pack['templates'] ?? [] ) ),
			'globales'   => count( (array) ( $pack['globals'] ?? [] ) ),
			'paginas'    => count( (array) ( $pack['pages'] ?? [] ) ),
			'titulos'    => array_values(
				array_filter(
					array_map(
						static fn( $p ) => is_array( $p ) ? (string) ( $p['title'] ?? '' ) : '',
						(array) ( $pack['pages'] ?? [] )
					)
				)
			),
			'imagenes'   => count( self::imagenes_del_paquete( $pack ) ),
		];
	}

	/* ---------------------------------------------------------------- */
	/* Importar                                                          */

	/**
	 * Mete el paquete en este sitio y cuenta lo que ha hecho.
	 *
	 * @param array $pack El paquete.
	 * @param array $opts ['tokens'=>bool,'chrome'=>bool,'biblioteca'=>bool,'paginas'=>bool,'modo'=>'crear|reemplazar|saltar']
	 */
	public static function import( array $pack, array $opts = [] ): array {
		if ( empty( $pack['krg'] ) && empty( $pack['meridian'] ) ) {
			throw new \RuntimeException( __( 'El archivo no es un paquete KRG CMS válido.', 'meridian' ) );
		}
		$quiere = static fn( string $k ): bool => ! array_key_exists( $k, $opts ) || ! empty( $opts[ $k ] );
		$modo   = (string) ( $opts['modo'] ?? 'crear' );
		$modo   = in_array( $modo, self::MODOS, true ) ? $modo : 'crear';

		$informe = [
			'tokens'     => 'omitido',
			'chrome'     => 'omitido',
			'plantillas' => [
				'creadas'      => 0,
				'actualizadas' => 0,
			],
			'globales'   => [
				'creados'      => 0,
				'actualizados' => 0,
			],
			'paginas'    => [
				'creadas'       => 0,
				'reemplazadas'  => 0,
				'saltadas'      => 0,
				'fallidas'      => 0,
			],
			'enlaces'    => [
				'reconectados' => 0,
				'sin destino'  => [],
			],
			'avisos'     => [],
		];

		/* 1. Tokens.
		     `TokenRepository::save()` reemplaza el grupo entero, así que
		     un paquete que sólo traiga cinco colores —el que sale del
		     medidor de estilo, por ejemplo— dejaría al tema sin los
		     demás papeles. Se fusiona token a token sobre lo que ya hay:
		     lo que viene manda, lo que no viene se queda. */
		if ( $quiere( 'tokens' ) && ! empty( $pack['tokens'] ) && is_array( $pack['tokens'] ) ) {
			$entran = $pack['tokens'];
			$ahora  = (array) ( TokenRepository::get()['tokens'] ?? [] );
			foreach ( (array) ( $entran['tokens'] ?? [] ) as $grupo => $valores ) {
				if ( ! is_array( $valores ) ) {
					continue;
				}
				$entran['tokens'][ $grupo ] = array_replace(
					is_array( $ahora[ $grupo ] ?? null ) ? $ahora[ $grupo ] : [],
					$valores
				);
			}
			TokenRepository::save( $entran );
			$informe['tokens'] = 'puestos';
		}

		/* 2. Biblioteca. Va antes que las páginas porque una página
		     puede llevar dentro una instancia de un componente global, y
		     esa instancia guarda el identificador del global. */
		$mapa_globales = [];
		if ( $quiere( 'biblioteca' ) ) {
			foreach ( (array) ( $pack['globals'] ?? [] ) as $g ) {
				if ( ! is_array( $g ) ) {
					continue;
				}
				$antes  = (int) ( $g['id'] ?? 0 );
				$existe = self::buscar_por_nombre( 'meridian_global', (string) ( $g['name'] ?? '' ) );
				$nuevo  = GlobalsRepository::save( 'meridian_global', $g, $existe );
				$mapa_globales[ $antes ] = (int) $nuevo['id'];
				$informe['globales'][ $existe ? 'actualizados' : 'creados' ]++;
			}
			foreach ( (array) ( $pack['templates'] ?? [] ) as $t ) {
				if ( ! is_array( $t ) ) {
					continue;
				}
				$existe = self::buscar_por_nombre( 'meridian_template', (string) ( $t['name'] ?? '' ) );
				GlobalsRepository::save( 'meridian_template', $t, $existe );
				$informe['plantillas'][ $existe ? 'actualizadas' : 'creadas' ]++;
			}
		}

		/* 3. Páginas. Primero entran todas, para que al reconectar los
		     enlaces esté ya la lista entera de slugs. */
		$creadas = [];
		if ( $quiere( 'paginas' ) ) {
			foreach ( (array) ( $pack['pages'] ?? [] ) as $page ) {
				if ( ! is_array( $page ) ) {
					continue;
				}
				$slug  = sanitize_title( (string) ( $page['slug'] ?? '' ) );
				$local = $slug ? self::pagina_por_slug( $slug ) : 0;

				if ( $local && 'saltar' === $modo ) {
					$informe['paginas']['saltadas']++;
					continue;
				}
				$page['sections'] = PageRepository::regen_ids( (array) ( $page['sections'] ?? [] ) );
				$page['sections'] = self::remapear_globales( $page['sections'], $mapa_globales );
				unset( $page['id'], $page['checksum'], $page['previewUrl'], $page['publicUrl'] );

				try {
					if ( $local && 'reemplazar' === $modo ) {
						$page['slug'] = $slug;
						$doc          = PageRepository::save_draft( $local, $page );
						$informe['paginas']['reemplazadas']++;
					} else {
						$doc = PageRepository::create(
							[
								'title'    => $page['title'] ?? __( 'Importada', 'meridian' ),
								'slug'     => $slug,
								'document' => $page,
							]
						);
						$informe['paginas']['creadas']++;
					}
					$creadas[] = [
						'id'         => (int) $doc['id'],
						'slugOrigen' => $slug,
					];
				} catch ( \Throwable $e ) {
					$informe['paginas']['fallidas']++;
					\Meridian\Log\Logger::error( $e->getMessage() );
				}
			}
		}

		/* 4. Reconectar los enlaces, ya con todas las páginas dentro. */
		$destinos = self::destinos( $pack, $creadas );
		$cuenta   = [
			'ok'    => 0,
			'perdi' => [],
		];

		foreach ( $creadas as $c ) {
			$doc = PageRepository::get( $c['id'], 'draft' );
			if ( ! $doc ) {
				continue;
			}
			$antes            = wp_json_encode( $doc['sections'] ?? [] );
			$doc['sections'] = self::reconectar_nodos( (array) ( $doc['sections'] ?? [] ), $destinos, $cuenta );
			if ( wp_json_encode( $doc['sections'] ) !== $antes ) {
				PageRepository::save_draft( $c['id'], $doc );
			}
		}

		/* 5. Cabecera, pie y menús: al final, ya con las páginas puestas,
		     que sus enlaces apuntan a páginas por identificador. */
		if ( $quiere( 'chrome' ) ) {
			if ( ! empty( $pack['menus'] ) && is_array( $pack['menus'] ) ) {
				Menus::save( self::reconectar_menus( $pack['menus'], $pack, $destinos, $cuenta ) );
			}
			if ( ! empty( $pack['header'] ) && is_array( $pack['header'] ) ) {
				// Lo que el paquete no traiga se queda como esta aqui: un
				// paquete a medias no puede dejar la cabecera sin ajustes.
				$cab = wp_parse_args( self::reconectar_plano( $pack['header'], $destinos, $cuenta ), Menus::header() );
				Menus::save_header( $cab );
			}
			if ( ! empty( $pack['footer'] ) && is_array( $pack['footer'] ) ) {
				$pie = wp_parse_args( self::reconectar_plano( $pack['footer'], $destinos, $cuenta ), Menus::footer() );
				if ( ! empty( $pie['sections'] ) && is_array( $pie['sections'] ) ) {
					$pie['sections'] = self::reconectar_nodos( $pie['sections'], $destinos, $cuenta );
				}
				Menus::save_footer( $pie );
			}
			$informe['chrome'] = 'puesto';
		}

		$informe['enlaces']['reconectados'] = $cuenta['ok'];
		$informe['enlaces']['sin destino']  = array_values( array_unique( $cuenta['perdi'] ) );

		/* 6. Avisos de lo que el paquete no puede traer. */
		$fotos = count( self::imagenes_del_paquete( $pack ) );
		if ( $fotos ) {
			$informe['avisos'][] = sprintf(
				/* translators: %d: cuantas fotos. */
				_n(
					'El paquete no lleva las fotos dentro: hay %d imagen que apunta a la Biblioteca del sitio de origen y habrá que volver a elegirla aquí.',
					'El paquete no lleva las fotos dentro: hay %d imágenes que apuntan a la Biblioteca del sitio de origen y habrá que volver a elegirlas aquí.',
					$fotos,
					'meridian'
				),
				$fotos
			);
		}
		if ( $informe['enlaces']['sin destino'] ) {
			$informe['avisos'][] = __( 'Algunos enlaces apuntaban a páginas que aquí no existen. Se han dejado como estaban, sin tocar.', 'meridian' );
		}

		\Meridian\Cache\DocumentCache::flush_all();
		return $informe;
	}

	/* ---------------------------------------------------------------- */
	/* Reconectar                                                        */

	/**
	 * La tabla de destinos: slug → ['id'=>int,'url'=>string], mas el
	 * mapa de identificadores del origen a slugs.
	 */
	private static function destinos( array $pack, array $creadas ): array {
		$por_slug = [];
		foreach ( $creadas as $c ) {
			if ( $c['slugOrigen'] ) {
				$por_slug[ $c['slugOrigen'] ] = $c['id'];
			}
		}
		// Y las que ya estaban aquí: un enlace del paquete puede apuntar
		// a una página que este sitio ya tenía.
		foreach ( PageRepository::list() as $p ) {
			$s = (string) $p['slug'];
			if ( $s && ! isset( $por_slug[ $s ] ) ) {
				$por_slug[ $s ] = (int) $p['id'];
			}
		}
		$urls = [];
		foreach ( $por_slug as $s => $pid ) {
			$link = get_permalink( $pid );
			$urls[ $s ] = [
				'id'  => $pid,
				'url' => is_string( $link ) ? $link : '',
			];
		}
		return [
			'porSlug'    => $urls,
			'porIdAntes' => (array) ( $pack['paginasPorId'] ?? [] ),
			'origen'     => (string) ( $pack['origen']['home'] ?? '' ),
		];
	}

	/** El slug al que apunta una direccion, si apunta a algo de casa. */
	private static function slug_de_url( string $url, array $destinos ): ?string {
		$url = trim( $url );
		if ( '' === $url || '#' === $url[0] ) {
			return null;
		}
		if ( preg_match( '#^(mailto:|tel:|javascript:)#i', $url ) ) {
			return null;
		}
		$origen = $destinos['origen'];
		if ( preg_match( '#^https?://#i', $url ) ) {
			// Externa de verdad: no es del sitio de origen ni de este.
			$de_casa = ( $origen && 0 === strpos( $url, $origen ) ) || 0 === strpos( $url, home_url( '/' ) );
			if ( ! $de_casa ) {
				return null;
			}
			$camino = (string) wp_parse_url( $url, PHP_URL_PATH );
		} elseif ( '/' === $url[0] ) {
			$camino = $url;
		} else {
			return null;
		}
		$trozos = array_values( array_filter( explode( '/', trim( $camino, '/' ) ) ) );
		if ( ! $trozos ) {
			return null;
		}
		return sanitize_title( (string) end( $trozos ) );
	}

	/** Cambia una direccion por la de aqui, si se sabe cual es. */
	private static function reconectar_url( string $url, array $destinos, array &$cuenta ): string {
		$slug = self::slug_de_url( $url, $destinos );
		if ( null === $slug ) {
			return $url;
		}
		$hit = $destinos['porSlug'][ $slug ] ?? null;
		if ( ! $hit || '' === $hit['url'] ) {
			$cuenta['perdi'][] = $url;
			return $url;
		}
		if ( $hit['url'] !== $url ) {
			$cuenta['ok']++;
		}
		return $hit['url'];
	}

	/** Las claves de un bloque que guardan una direccion. */
	private static function claves_de_enlace( string $tipo ): array {
		$def   = Registry::get( $tipo );
		$claves = [];
		$mirar = static function ( array $fields ) use ( &$mirar, &$claves ): void {
			foreach ( $fields as $f ) {
				$t = (string) ( $f['type'] ?? '' );
				if ( in_array( $t, [ 'url', 'mapsUrl' ], true ) ) {
					$claves[] = (string) ( $f['key'] ?? '' );
				}
				if ( 'repeater' === $t ) {
					$mirar( (array) ( $f['itemFields'] ?? $f['fields'] ?? [] ) );
				}
			}
		};
		if ( $def ) {
			$mirar( (array) ( $def['fields'] ?? [] ) );
		}
		// Por si un bloque guarda un enlace sin declararlo en su ficha.
		return array_values( array_unique( array_merge( $claves, [ 'url', 'link', 'linkUrl', 'buttonUrl', 'ctaUrl', 'a' ] ) ) );
	}

	/** Recorre un arbol de bloques reconectando lo que sean enlaces. */
	private static function reconectar_nodos( array $nodes, array $destinos, array &$cuenta ): array {
		foreach ( $nodes as &$n ) {
			if ( ! is_array( $n ) ) {
				continue;
			}
			$claves = self::claves_de_enlace( (string) ( $n['type'] ?? '' ) );
			if ( ! empty( $n['props'] ) && is_array( $n['props'] ) ) {
				$n['props'] = self::reconectar_props( $n['props'], $claves, $destinos, $cuenta );
			}
			if ( ! empty( $n['children'] ) && is_array( $n['children'] ) ) {
				$n['children'] = self::reconectar_nodos( $n['children'], $destinos, $cuenta );
			}
		}
		return $nodes;
	}

	private static function reconectar_props( array $props, array $claves, array $destinos, array &$cuenta ): array {
		foreach ( $props as $k => $v ) {
			if ( is_string( $v ) && in_array( (string) $k, $claves, true ) ) {
				$props[ $k ] = self::reconectar_url( $v, $destinos, $cuenta );
				continue;
			}
			if ( is_array( $v ) ) {
				foreach ( $v as $i => $fila ) {
					if ( is_array( $fila ) ) {
						$v[ $i ] = self::reconectar_props( $fila, $claves, $destinos, $cuenta );
					}
				}
				$props[ $k ] = $v;
			}
		}
		return $props;
	}

	/** Un ajuste plano —cabecera, pie— con alguna direccion dentro. */
	private static function reconectar_plano( array $datos, array $destinos, array &$cuenta ): array {
		foreach ( $datos as $k => $v ) {
			if ( is_string( $v ) && preg_match( '/url$/i', (string) $k ) ) {
				$datos[ $k ] = self::reconectar_url( $v, $destinos, $cuenta );
			}
		}
		return $datos;
	}

	/**
	 * Los menus: ademas de la direccion, guardan el identificador de la
	 * pagina, que aqui es otro.
	 */
	private static function reconectar_menus( array $menus, array $pack, array $destinos, array &$cuenta ): array {
		$antes = (array) ( $destinos['porIdAntes'] ?? [] );
		$arregla = static function ( array $items ) use ( &$arregla, $antes, $destinos, &$cuenta ): array {
			foreach ( $items as &$it ) {
				if ( ! is_array( $it ) ) {
					continue;
				}
				$pid = (int) ( $it['pageId'] ?? 0 );
				if ( $pid ) {
					$slug = (string) ( $antes[ $pid ] ?? $antes[ (string) $pid ] ?? '' );
					$hit  = $slug ? ( $destinos['porSlug'][ $slug ] ?? null ) : null;
					if ( $hit ) {
						if ( (int) $hit['id'] !== $pid ) {
							$cuenta['ok']++;
						}
						$it['pageId'] = (int) $hit['id'];
					} else {
						// Sin destino conocido, antes que apuntar a la
						// pagina equivocada de aqui, no apunta a ninguna.
						$cuenta['perdi'][] = $slug ? '/' . $slug : sprintf( 'pageId %d', $pid );
						$it['pageId']      = 0;
					}
				}
				if ( ! empty( $it['url'] ) && is_string( $it['url'] ) ) {
					$it['url'] = self::reconectar_url( $it['url'], $destinos, $cuenta );
				}
				if ( ! empty( $it['children'] ) && is_array( $it['children'] ) ) {
					$it['children'] = $arregla( $it['children'] );
				}
			}
			return $items;
		};
		foreach ( $menus as &$m ) {
			if ( is_array( $m ) && ! empty( $m['items'] ) && is_array( $m['items'] ) ) {
				$m['items'] = $arregla( $m['items'] );
			}
		}
		return $menus;
	}

	/* ---------------------------------------------------------------- */
	/* Ayudas                                                            */

	/** Un componente global o plantilla que ya exista con ese nombre. */
	private static function buscar_por_nombre( string $type, string $nombre ): int {
		$nombre = trim( $nombre );
		if ( '' === $nombre ) {
			return 0;
		}
		foreach ( GlobalsRepository::list( $type ) as $x ) {
			if ( trim( (string) $x['name'] ) === $nombre ) {
				return (int) $x['id'];
			}
		}
		return 0;
	}

	/** Una pagina de aqui con ese slug, si la hay. */
	private static function pagina_por_slug( string $slug ): int {
		foreach ( PageRepository::list() as $p ) {
			if ( (string) $p['slug'] === $slug ) {
				return (int) $p['id'];
			}
		}
		return 0;
	}

	/** Las instancias de componentes globales apuntan al identificador del origen. */
	private static function remapear_globales( array $nodes, array $mapa ): array {
		foreach ( $nodes as &$n ) {
			if ( ! is_array( $n ) ) {
				continue;
			}
			$gid = (int) ( $n['globalId'] ?? 0 );
			if ( $gid && isset( $mapa[ $gid ] ) ) {
				$n['globalId'] = (int) $mapa[ $gid ];
			} elseif ( $gid ) {
				// Sin su global aqui, la instancia se queda como copia
				// local: mejor un bloque suelto que uno que apunta a la
				// nada y se pinta vacio.
				$n['globalId'] = 0;
				$n['source']   = 'local';
			}
			if ( ! empty( $n['children'] ) && is_array( $n['children'] ) ) {
				$n['children'] = self::remapear_globales( $n['children'], $mapa );
			}
		}
		return $nodes;
	}

	/** Todos los identificadores de imagen que menciona el paquete. */
	private static function imagenes_del_paquete( array $pack ): array {
		$ids  = [];
		$json = wp_json_encode(
			[
				$pack['pages'] ?? [],
				$pack['templates'] ?? [],
				$pack['globals'] ?? [],
				$pack['header'] ?? [],
				$pack['footer'] ?? [],
			]
		);
		if ( ! is_string( $json ) ) {
			return [];
		}
		if ( preg_match_all( '/"(?:[a-zA-Z]*[iI]mage|logo|icon|badge)[a-zA-Z]*Id"\s*:\s*(\d+)/', $json, $m ) ) {
			foreach ( $m[1] as $x ) {
				if ( (int) $x > 0 ) {
					$ids[ (int) $x ] = true;
				}
			}
		}
		if ( preg_match_all( '/"(?:logoId|logoMobile|imageId|iconId|badgeId|ogImageId)"\s*:\s*(\d+)/', $json, $m2 ) ) {
			foreach ( $m2[1] as $x ) {
				if ( (int) $x > 0 ) {
					$ids[ (int) $x ] = true;
				}
			}
		}
		return array_keys( $ids );
	}
}
