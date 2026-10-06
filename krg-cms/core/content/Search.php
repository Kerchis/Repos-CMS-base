<?php
/**
 * Buscar —y reemplazar— por todo el sitio.
 *
 * El caso de siempre: cambia el teléfono, cambia el horario, la marca
 * pasa de «C/ Mayor 3» a «Avenida del Puerto 12», o el dominio de
 * pruebas se queda escrito en veinte botones. Sin esto hay que abrir
 * página por página y mirar bloque por bloque, que es justo donde se
 * cuelan los olvidos.
 *
 * Qué mira: el texto de los bloques de todas las páginas —incluidos
 * los campos de las listas repetidas—, el título de la página, los
 * campos de SEO y, si se pide, la cabecera, el pie y los menús.
 *
 * Qué **no** hace, a propósito:
 *
 *   - No toca la dirección de la página (el *slug*). Cambiarla por un
 *     reemplazo masivo rompería los enlaces de fuera sin avisar.
 *   - No toca identificadores, ni colores, ni medidas: sólo texto y
 *     direcciones de enlace.
 *   - No publica. Escribe en el borrador y deja que cada página se
 *     publique cuando toque, que es lo que hace el resto del panel.
 *
 * Y como cada escritura pasa por `PageRepository::save_draft()`, queda
 * una versión en el historial: un reemplazo masivo se puede deshacer
 * página a página desde «Historial».
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class Search {

	/**
	 * Qué clases de campo son texto de verdad.
	 *
	 * Lo dice el registro de bloques, no una lista escrita a mano: un
	 * `select` es un ajuste, un `color` es un color y un `number` es una
	 * medida. Reemplazar dentro de ellos no arregla nada y rompe el
	 * diseño sin que nadie lo vea hasta el día siguiente.
	 */
	private const TIPOS_TEXTO = [ 'text', 'textarea', 'richtext', 'url', 'mapsUrl' ];

	/** Claves que no se tocan en la cabecera y el pie, que no pasan por el registro. */
	private const INTOCABLES = [
		'id',
		'globalId',
		'imageId',
		'mobileImageId',
		'logoId',
		'faviconId',
		'iconId',
		'badgeId',
		'ogImageId',
		'ids',
		'type',
		'source',
		'slug',
		'pageId',
		'variant',
		'layout',
		'align',
		'tag',
		'target',
		'theme',
		'size',
		'shape',
		'ratio',
	];

	/** Cuánto texto se enseña alrededor de cada hallazgo. */
	private const CONTEXTO = 40;

	/**
	 * Buscar.
	 *
	 * @param string $q    Lo que se busca.
	 * @param array  $opts sensible (mayúsculas), entera (palabra entera), chrome.
	 */
	public static function buscar( string $q, array $opts = [] ): array {
		$q = (string) $q;
		if ( '' === trim( $q ) ) {
			return [
				'consulta' => $q,
				'total'    => 0,
				'paginas'  => [],
				'chrome'   => [],
			];
		}
		$paginas = [];
		$total   = 0;
		foreach ( PageRepository::list() as $resumen ) {
			$id  = (int) $resumen['id'];
			$doc = PageRepository::get( $id, 'draft' );
			if ( ! $doc ) {
				continue;
			}
			$hallazgos = self::en_documento( $doc, $q, $opts );
			if ( ! $hallazgos ) {
				continue;
			}
			$total    += count( $hallazgos );
			$paginas[] = [
				'id'        => $id,
				'title'     => (string) ( $doc['title'] ?? $resumen['title'] ?? '' ),
				'slug'      => (string) ( $doc['slug'] ?? '' ),
				'hallazgos' => $hallazgos,
			];
		}

		$chrome = [];
		if ( ! empty( $opts['chrome'] ) ) {
			$chrome = self::en_chrome( $q, $opts );
			$total += count( $chrome );
		}

		return [
			'consulta' => $q,
			'total'    => $total,
			'paginas'  => $paginas,
			'chrome'   => $chrome,
		];
	}

	/**
	 * Reemplazar.
	 *
	 * Sólo en lo que se le diga: `paginas` es la lista de identificadores
	 * que el usuario ha dejado marcados después de ver los hallazgos. Sin
	 * lista no se toca nada, que es lo prudente para una operación que
	 * cambia veinte páginas de golpe.
	 */
	public static function reemplazar( string $q, string $por, array $opts = [] ): array {
		$informe = [
			'paginas' => 0,
			'cambios' => 0,
			'chrome'  => 0,
			'detalle' => [],
			'avisos'  => [],
		];
		if ( '' === trim( $q ) ) {
			$informe['avisos'][] = __( 'No se ha dicho qué buscar.', 'meridian' );
			return $informe;
		}
		$quiere = array_map( 'absint', (array) ( $opts['paginas'] ?? [] ) );

		foreach ( $quiere as $id ) {
			$doc = PageRepository::get( $id, 'draft' );
			if ( ! $doc ) {
				continue;
			}
			$cuenta = 0;
			$nuevo  = self::cambiar_documento( $doc, $q, $por, $opts, $cuenta );
			if ( ! $cuenta ) {
				continue;
			}
			try {
				PageRepository::save_draft( $id, $nuevo );
			} catch ( \Throwable $e ) {
				$informe['avisos'][] = sprintf(
					/* translators: 1: page title, 2: error message. */
					__( 'No se pudo guardar «%1$s»: %2$s', 'meridian' ),
					(string) ( $doc['title'] ?? $id ),
					$e->getMessage()
				);
				continue;
			}
			$informe['paginas']++;
			$informe['cambios'] += $cuenta;
			$informe['detalle'][] = [
				'id'      => $id,
				'title'   => (string) ( $doc['title'] ?? '' ),
				'cambios' => $cuenta,
			];
		}

		if ( ! empty( $opts['chrome'] ) ) {
			$informe['chrome'] = self::cambiar_chrome( $q, $por, $opts );
			$informe['cambios'] += $informe['chrome'];
		}

		if ( $informe['cambios'] ) {
			\Meridian\Cache\DocumentCache::flush_all();
			$informe['avisos'][] = __( 'Los cambios están en el borrador de cada página: para que se vean en la web hay que publicarlas.', 'meridian' );
		}
		return $informe;
	}

	/* ================================================================ */

	/** Los hallazgos de un documento, con su contexto. */
	private static function en_documento( array $doc, string $q, array $opts ): array {
		$fuera = [];
		$titulo = (string) ( $doc['title'] ?? '' );
		if ( self::hay( $titulo, $q, $opts ) ) {
			$fuera[] = self::hallazgo( '', 'página', __( 'Título de la página', 'meridian' ), $titulo, $q, $opts );
		}
		foreach ( [ 'title' => __( 'Título SEO', 'meridian' ), 'description' => __( 'Descripción SEO', 'meridian' ) ] as $k => $etiqueta ) {
			$valor = (string) ( $doc['seo'][ $k ] ?? '' );
			if ( self::hay( $valor, $q, $opts ) ) {
				$fuera[] = self::hallazgo( '', 'seo', $etiqueta, $valor, $q, $opts );
			}
		}
		self::por_nodos(
			$doc['sections'] ?? [],
			static function ( array $nodo ) use ( &$fuera, $q, $opts ) {
				foreach ( self::textos_de( $nodo ) as $campo => $valor ) {
					if ( self::hay( $valor, $q, $opts ) ) {
						$fuera[] = self::hallazgo(
							(string) ( $nodo['id'] ?? '' ),
							(string) ( $nodo['type'] ?? '' ),
							$campo,
							$valor,
							$q,
							$opts
						);
					}
				}
			}
		);
		return $fuera;
	}

	/** Lo mismo, pero cambiando. Devuelve el documento nuevo. */
	private static function cambiar_documento( array $doc, string $q, string $por, array $opts, int &$cuenta ): array {
		if ( isset( $doc['title'] ) ) {
			$doc['title'] = self::cambiar( (string) $doc['title'], $q, $por, $opts, $cuenta );
		}
		foreach ( [ 'title', 'description' ] as $k ) {
			if ( isset( $doc['seo'][ $k ] ) ) {
				$doc['seo'][ $k ] = self::cambiar( (string) $doc['seo'][ $k ], $q, $por, $opts, $cuenta );
			}
		}
		$doc['sections'] = self::cambiar_nodos( $doc['sections'] ?? [], $q, $por, $opts, $cuenta );
		return $doc;
	}

	private static function cambiar_nodos( array $nodos, string $q, string $por, array $opts, int &$cuenta ): array {
		foreach ( $nodos as $i => $nodo ) {
			if ( ! is_array( $nodo ) ) {
				continue;
			}
			if ( isset( $nodo['props'] ) && is_array( $nodo['props'] ) ) {
				$nodos[ $i ]['props'] = self::cambiar_props(
					(string) ( $nodo['type'] ?? '' ),
					$nodo['props'],
					$q,
					$por,
					$opts,
					$cuenta
				);
			}
			if ( ! empty( $nodo['children'] ) && is_array( $nodo['children'] ) ) {
				$nodos[ $i ]['children'] = self::cambiar_nodos( $nodo['children'], $q, $por, $opts, $cuenta );
			}
		}
		return $nodos;
	}

	/** Recorre props —incluidas las listas repetidas— cambiando textos. */
	private static function cambiar_valores( array $valores, string $q, string $por, array $opts, int &$cuenta ): array {
		foreach ( $valores as $clave => $valor ) {
			if ( in_array( (string) $clave, self::INTOCABLES, true ) ) {
				continue;
			}
			if ( is_string( $valor ) ) {
				if ( self::texto_util( (string) $clave, $valor ) ) {
					$valores[ $clave ] = self::cambiar( $valor, $q, $por, $opts, $cuenta );
				}
				continue;
			}
			if ( is_array( $valor ) ) {
				$valores[ $clave ] = self::cambiar_valores( $valor, $q, $por, $opts, $cuenta );
			}
		}
		return $valores;
	}

	/**
	 * El esquema de un bloque, reducido a lo que es texto.
	 *
	 * Devuelve `clave => 'campo'` para los campos sueltos y
	 * `clave => ['repetidor' => [subclave => true]]` para las listas.
	 */
	private static function esquema( string $tipo ): array {
		static $cache = [];
		if ( isset( $cache[ $tipo ] ) ) {
			return $cache[ $tipo ];
		}
		$def   = \Meridian\Components\Registry::get( $tipo );
		$mapa  = [];
		foreach ( (array) ( $def['fields'] ?? [] ) as $campo ) {
			$clave = (string) ( $campo['key'] ?? '' );
			$clase = (string) ( $campo['type'] ?? '' );
			if ( '' === $clave ) {
				continue;
			}
			if ( 'repeater' === $clase ) {
				$dentro = [];
				foreach ( (array) ( $campo['itemFields'] ?? [] ) as $sub ) {
					if ( in_array( (string) ( $sub['type'] ?? '' ), self::TIPOS_TEXTO, true ) && ! empty( $sub['key'] ) ) {
						$dentro[ (string) $sub['key'] ] = true;
					}
				}
				if ( $dentro ) {
					$mapa[ $clave ] = [ 'repetidor' => $dentro ];
				}
				continue;
			}
			if ( in_array( $clase, self::TIPOS_TEXTO, true ) ) {
				$mapa[ $clave ] = 'campo';
			}
		}
		$cache[ $tipo ] = $mapa;
		return $mapa;
	}

	/** Los textos de un nodo, con la ruta como nombre del campo. */
	private static function textos_de( array $nodo ): array {
		$fuera = [];
		$props = is_array( $nodo['props'] ?? null ) ? $nodo['props'] : [];
		foreach ( self::esquema( (string) ( $nodo['type'] ?? '' ) ) as $clave => $que ) {
			if ( 'campo' === $que ) {
				$valor = $props[ $clave ] ?? null;
				if ( is_string( $valor ) && '' !== trim( $valor ) ) {
					$fuera[ $clave ] = $valor;
				}
				continue;
			}
			foreach ( (array) ( $props[ $clave ] ?? [] ) as $i => $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				foreach ( $que['repetidor'] as $sub => $_ ) {
					$valor = $item[ $sub ] ?? null;
					if ( is_string( $valor ) && '' !== trim( $valor ) ) {
						$fuera[ $clave . '.' . $i . '.' . $sub ] = $valor;
					}
				}
			}
		}
		return $fuera;
	}

	/** Lo mismo, cambiando: sólo los campos que el registro dice que son texto. */
	private static function cambiar_props( string $tipo, array $props, string $q, string $por, array $opts, int &$cuenta ): array {
		foreach ( self::esquema( $tipo ) as $clave => $que ) {
			if ( 'campo' === $que ) {
				if ( isset( $props[ $clave ] ) && is_string( $props[ $clave ] ) ) {
					$props[ $clave ] = self::cambiar( $props[ $clave ], $q, $por, $opts, $cuenta );
				}
				continue;
			}
			if ( ! is_array( $props[ $clave ] ?? null ) ) {
				continue;
			}
			foreach ( $props[ $clave ] as $i => $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				foreach ( $que['repetidor'] as $sub => $_ ) {
					if ( isset( $item[ $sub ] ) && is_string( $item[ $sub ] ) ) {
						$props[ $clave ][ $i ][ $sub ] = self::cambiar( $item[ $sub ], $q, $por, $opts, $cuenta );
					}
				}
			}
		}
		return $props;
	}

	/** Los textos de la cabecera o el pie, que no pasan por el registro. */
	private static function textos( array $valores, string $prefijo = '' ): array {
		$fuera = [];
		foreach ( $valores as $clave => $valor ) {
			if ( in_array( (string) $clave, self::INTOCABLES, true ) ) {
				continue;
			}
			$nombre = '' === $prefijo ? (string) $clave : $prefijo . '.' . $clave;
			if ( is_string( $valor ) ) {
				if ( self::texto_util( (string) $clave, $valor ) ) {
					$fuera[ $nombre ] = $valor;
				}
				continue;
			}
			if ( is_array( $valor ) ) {
				foreach ( self::textos( $valor, $nombre ) as $k => $v ) {
					$fuera[ $k ] = $v;
				}
			}
		}
		return $fuera;
	}

	/**
	 * ¿Esto es texto de verdad?
	 *
	 * Un `#3F5E58`, un `24px` o un `cover` son ajustes, no contenido:
	 * reemplazar dentro de ellos sólo sirve para romper el diseño.
	 */
	private static function texto_util( string $clave, string $valor ): bool {
		if ( '' === trim( $valor ) ) {
			return false;
		}
		if ( preg_match( '/^#[0-9A-Fa-f]{3,8}$/', $valor ) ) {
			return false;
		}
		if ( preg_match( '/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|svh|dvh)?$/', $valor ) ) {
			return false;
		}
		if ( str_ends_with( $clave, 'Id' ) || str_ends_with( $clave, 'Color' ) ) {
			return false;
		}
		return true;
	}

	/** Ficha de un hallazgo, con un trozo de texto alrededor. */
	private static function hallazgo( string $nodeId, string $tipo, string $campo, string $valor, string $q, array $opts ): array {
		$plano = trim( preg_replace( '/\s+/u', ' ', wp_strip_all_tags( $valor ) ) );
		$pos   = self::posicion( $plano, $q, $opts );
		$desde = max( 0, $pos - self::CONTEXTO );
		$trozo = mb_substr( $plano, $desde, mb_strlen( $q ) + ( self::CONTEXTO * 2 ) );
		return [
			'nodeId'   => $nodeId,
			'tipo'     => $tipo,
			'campo'    => $campo,
			'contexto' => ( $desde > 0 ? '…' : '' ) . $trozo . ( mb_strlen( $plano ) > $desde + mb_strlen( $trozo ) ? '…' : '' ),
			'veces'    => self::veces( $plano, $q, $opts ),
		];
	}

	private static function patron( string $q, array $opts ): string {
		$p = preg_quote( $q, '/' );
		if ( ! empty( $opts['entera'] ) ) {
			$p = '(?<![\p{L}\p{N}_])' . $p . '(?![\p{L}\p{N}_])';
		}
		return '/' . $p . '/u' . ( empty( $opts['sensible'] ) ? 'i' : '' );
	}

	private static function hay( string $texto, string $q, array $opts ): bool {
		return '' !== $texto && (bool) preg_match( self::patron( $q, $opts ), $texto );
	}

	private static function veces( string $texto, string $q, array $opts ): int {
		return (int) preg_match_all( self::patron( $q, $opts ), $texto );
	}

	private static function posicion( string $texto, string $q, array $opts ): int {
		if ( preg_match( self::patron( $q, $opts ), $texto, $m, PREG_OFFSET_CAPTURE ) ) {
			return (int) mb_strlen( substr( $texto, 0, (int) $m[0][1] ) );
		}
		return 0;
	}

	private static function cambiar( string $texto, string $q, string $por, array $opts, int &$cuenta ): string {
		if ( '' === $texto ) {
			return $texto;
		}
		$veces = 0;
		$nuevo = preg_replace( self::patron( $q, $opts ), str_replace( '\\', '\\\\', $por ), $texto, -1, $veces );
		if ( null === $nuevo ) {
			return $texto;
		}
		$cuenta += (int) $veces;
		return $nuevo;
	}

	/** Baja por el árbol llamando a `$ver` con cada nodo. */
	private static function por_nodos( array $nodos, callable $ver ): void {
		foreach ( $nodos as $nodo ) {
			if ( ! is_array( $nodo ) ) {
				continue;
			}
			$ver( $nodo );
			if ( ! empty( $nodo['children'] ) && is_array( $nodo['children'] ) ) {
				self::por_nodos( $nodo['children'], $ver );
			}
		}
	}

	/* ------------------------- cabecera y pie ------------------------ */

	private static function en_chrome( string $q, array $opts ): array {
		$fuera = [];
		foreach ( [ 'header' => __( 'Cabecera', 'meridian' ), 'footer' => __( 'Pie', 'meridian' ) ] as $cual => $etiqueta ) {
			$datos = 'header' === $cual ? \Meridian\Navigation\Menus::header() : \Meridian\Navigation\Menus::footer();
			foreach ( self::textos( is_array( $datos ) ? $datos : [] ) as $campo => $valor ) {
				if ( self::hay( $valor, $q, $opts ) ) {
					$uno          = self::hallazgo( '', $cual, $campo, $valor, $q, $opts );
					$uno['donde'] = $etiqueta;
					$fuera[]      = $uno;
				}
			}
		}
		return $fuera;
	}

	private static function cambiar_chrome( string $q, string $por, array $opts ): int {
		$cuenta = 0;
		$cab    = \Meridian\Navigation\Menus::header();
		$nueva  = self::cambiar_valores( is_array( $cab ) ? $cab : [], $q, $por, $opts, $cuenta );
		if ( $cuenta ) {
			\Meridian\Navigation\Menus::save_header( $nueva );
		}
		$antes = $cuenta;
		$pie   = \Meridian\Navigation\Menus::footer();
		$nuevo = self::cambiar_valores( is_array( $pie ) ? $pie : [], $q, $por, $opts, $cuenta );
		if ( $cuenta > $antes ) {
			\Meridian\Navigation\Menus::save_footer( $nuevo );
		}
		return $cuenta;
	}
}
