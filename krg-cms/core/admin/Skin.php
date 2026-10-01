<?php
/**
 * Colores del propio CMS.
 *
 * admin.css está escrito contra variables en :root, así que reskinear el
 * panel es cuestión de reescribir esas variables. Nada de esto afecta al
 * sitio público.
 *
 * @package Meridian
 */

namespace Meridian\Admin;

defined( 'ABSPATH' ) || exit;

class Skin {

	/**
	 * Clave interna => [variable CSS, etiqueta, valor por defecto].
	 */
	public static function schema(): array {
		return [
			'sidebar'     => [ '--m-brown', __( 'Barra lateral', 'meridian' ), '#3f5e58' ],
			'sidebarDeep' => [ '--m-brown-deep', __( 'Barra lateral (tono oscuro)', 'meridian' ), '#2b413d' ],
			'action'      => [ '--m-orange', __( 'Color de acción (botones)', 'meridian' ), '#3f5e58' ],
			'actionDeep'  => [ '--m-orange-deep', __( 'Acción al pasar el ratón', 'meridian' ), '#2b413d' ],
			'accentSoft'  => [ '--m-accent-soft', __( 'Tinte suave de acción', 'meridian' ), '#e7eeec' ],
			'paper'       => [ '--m-paper', __( 'Fondo del panel', 'meridian' ), '#fef6e7' ],
			'surface'     => [ '--m-surface', __( 'Superficie', 'meridian' ), '#f7ead1' ],
			'surfaceSoft' => [ '--m-surface-soft', __( 'Superficie suave', 'meridian' ), '#fbf2e1' ],
			'line'        => [ '--m-line', __( 'Líneas y bordes', 'meridian' ), '#e1d3b6' ],
			'lineStrong'  => [ '--m-line-strong', __( 'Bordes marcados', 'meridian' ), '#cbb894' ],
			'ink'         => [ '--m-ink', __( 'Texto', 'meridian' ), '#0c0f0e' ],
			'muted'       => [ '--m-muted', __( 'Texto secundario', 'meridian' ), '#78736a' ],
		];
	}

	/**
	 * Valores de fábrica.
	 */
	public static function defaults(): array {
		$out = [];
		foreach ( self::schema() as $key => $row ) {
			$out[ $key ] = $row[2];
		}
		return $out;
	}

	/**
	 * Colores guardados, completados con los de fábrica.
	 */
	public static function get(): array {
		$saved = get_option( MERIDIAN_OPTION_ADMIN_SKIN, [] );
		$saved = is_array( $saved ) ? $saved : [];
		return array_merge( self::defaults(), self::sanitize( $saved ) );
	}

	/**
	 * Solo claves conocidas y solo colores hex válidos.
	 */
	public static function sanitize( array $data ): array {
		$out = [];
		foreach ( self::schema() as $key => $row ) {
			if ( ! array_key_exists( $key, $data ) ) {
				continue;
			}
			$hex = sanitize_hex_color( (string) $data[ $key ] );
			if ( $hex ) {
				$out[ $key ] = $hex;
			}
		}
		return $out;
	}

	/**
	 * Guarda y devuelve el resultado completo.
	 */
	public static function save( array $data ): array {
		update_option( MERIDIAN_OPTION_ADMIN_SKIN, self::sanitize( $data ), false );
		return self::get();
	}

	/**
	 * Vuelve a los colores de fábrica.
	 */
	public static function reset(): array {
		delete_option( MERIDIAN_OPTION_ADMIN_SKIN );
		return self::get();
	}

	/**
	 * Propone unos colores de panel a partir de la paleta del sitio, para
	 * que el CMS pueda ir a juego sin elegir doce colores a mano.
	 */
	public static function from_tokens(): array {
		$color = \Meridian\Design\TokenRepository::get()['tokens']['color'] ?? [];
		$pick  = static function ( string $key, string $fallback ) use ( $color ): string {
			$hex = sanitize_hex_color( (string) ( $color[ $key ]['value'] ?? '' ) );
			return $hex ? $hex : $fallback;
		};
		$d = self::defaults();
		return [
			'sidebar'     => $pick( 'primary', $d['sidebar'] ),
			'sidebarDeep' => $pick( 'secondary', $d['sidebarDeep'] ),
			'action'      => $pick( 'primary', $d['action'] ),
			'actionDeep'  => $pick( 'secondary', $d['actionDeep'] ),
			'accentSoft'  => $pick( 'highlight', $d['accentSoft'] ),
			'paper'       => $pick( 'background', $d['paper'] ),
			'surface'     => $pick( 'surface', $d['surface'] ),
			'surfaceSoft' => $pick( 'surface-alt', $d['surfaceSoft'] ),
			'line'        => $pick( 'border', $d['line'] ),
			'lineStrong'  => $pick( 'border-strong', $d['lineStrong'] ),
			'ink'         => $pick( 'text', $d['ink'] ),
			'muted'       => $pick( 'muted', $d['muted'] ),
		];
	}

	/**
	 * CSS en línea para el panel. Vacío si no hay nada personalizado, para
	 * no mandar bytes de más en cada carga.
	 */
	public static function css(): string {
		$saved = get_option( MERIDIAN_OPTION_ADMIN_SKIN, [] );
		$saved = is_array( $saved ) ? self::sanitize( $saved ) : [];
		if ( ! $saved ) {
			return '';
		}
		$schema = self::schema();
		$decl   = [];
		foreach ( $saved as $key => $hex ) {
			if ( isset( $schema[ $key ] ) ) {
				$decl[] = $schema[ $key ][0] . ':' . $hex;
			}
		}
		return $decl ? ':root{' . implode( ';', $decl ) . ';}' : '';
	}
}
