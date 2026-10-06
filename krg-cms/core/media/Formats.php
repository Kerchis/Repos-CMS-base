<?php
/**
 * Versiones modernas de las fotos: WebP y AVIF.
 *
 * Una foto de producto en JPEG de 400 KB pesa unos 150 en WebP y unos
 * 90 en AVIF, y se ve igual. No hay truco: son formatos más nuevos que
 * comprimen mejor. Lo único que hace falta es tener las dos versiones
 * en el disco y ofrecerlas por delante del archivo de siempre, que se
 * queda de respaldo para quien no las entienda.
 *
 * Cómo se hacen:
 *
 *   - Al subir una foto nueva, sola. WordPress genera sus tamaños y
 *     justo después pasa por aquí.
 *   - Las que ya estaban, con el botón de Configuración → Fotos, que
 *     las va preparando a tandas sin bloquear el panel.
 *
 * Dónde se apunta: en el adjunto, en `_krg_formats`, con el nombre de
 * archivo y el ancho de cada versión. Así el frontend arma el `srcset`
 * sin tocar el disco.
 *
 * Qué no se toca: el archivo original, nunca. Si la conversión sale
 * peor —pasa con los PNG pequeños, que a veces engordan— se borra la
 * versión nueva y la foto se queda como estaba.
 *
 * @package Meridian
 */

namespace Meridian\Media;

defined( 'ABSPATH' ) || exit;

class Formats {

	public const META = '_krg_formats';

	/** Lo que se intenta, por orden de preferencia. */
	public const MIMES = [ 'image/avif', 'image/webp' ];

	/** De esto no se saca nada: o ya es moderno, o se rompe al convertir. */
	private const NO_TOCAR = [ 'image/webp', 'image/avif', 'image/svg+xml', 'image/gif' ];

	public static function register(): void {
		add_filter( 'wp_generate_attachment_metadata', [ self::class, 'al_subir' ], 20, 2 );
		add_action( 'delete_attachment', [ self::class, 'al_borrar' ] );
	}

	/**
	 * ¿Qué formatos sabe escribir este servidor?
	 *
	 * No todos los hospedajes traen AVIF, y alguno viejo ni WebP. Se
	 * pregunta una vez por petición y se obra en consecuencia: lo que
	 * no se puede hacer, no se promete.
	 */
	public static function soportados(): array {
		static $cache = null;
		if ( null !== $cache ) {
			return $cache;
		}
		$cache = [];
		foreach ( self::MIMES as $mime ) {
			if ( function_exists( 'wp_image_editor_supports' ) && wp_image_editor_supports( [ 'mime_type' => $mime ] ) ) {
				$cache[] = $mime;
				continue;
			}
			if ( 'image/webp' === $mime && function_exists( 'imagewebp' ) ) {
				$cache[] = $mime;
			}
			if ( 'image/avif' === $mime && function_exists( 'imageavif' ) ) {
				$cache[] = $mime;
			}
		}
		return $cache;
	}

	/** Al subir una foto nueva. Devuelve los metadatos tal cual los recibió. */
	public static function al_subir( $metadata, $attachment_id ) {
		if ( is_array( $metadata ) ) {
			self::preparar( (int) $attachment_id );
		}
		return $metadata;
	}

	/** Al borrar la foto, se van también sus versiones. */
	public static function al_borrar( $attachment_id ): void {
		$id   = (int) $attachment_id;
		$base = self::carpeta( $id );
		if ( '' === $base ) {
			return;
		}
		foreach ( (array) get_post_meta( $id, self::META, true ) as $archivos ) {
			foreach ( (array) $archivos as $datos ) {
				$ruta = $base . '/' . ( $datos['file'] ?? '' );
				if ( ! empty( $datos['file'] ) && is_file( $ruta ) ) {
					wp_delete_file( $ruta );
				}
			}
		}
		delete_post_meta( $id, self::META );
	}

	/**
	 * Preparar las versiones modernas de una foto.
	 *
	 * Devuelve el parte: cuántos archivos se han escrito, cuánto pesaba
	 * lo de antes y cuánto lo nuevo. Si no había nada que hacer, lo
	 * dice en vez de callarse.
	 */
	public static function preparar( int $id ): array {
		$parte = [
			'id'      => $id,
			'hechas'  => 0,
			'antes'   => 0,
			'despues' => 0,
			'motivo'  => '',
		];
		$mimes = self::soportados();
		if ( ! $mimes ) {
			$parte['motivo'] = 'el servidor no sabe escribir ni WebP ni AVIF';
			return $parte;
		}
		$original = get_post_mime_type( $id );
		if ( ! $original || in_array( $original, self::NO_TOCAR, true ) ) {
			// Marcarla como mirada para no volver a intentarlo en cada
			// tanda, pero sin borrar lo que ya hubiera apuntado.
			if ( '' === get_post_meta( $id, self::META, true ) ) {
				update_post_meta( $id, self::META, [] );
			}
			$parte['motivo'] = 'esta foto no necesita conversión';
			return $parte;
		}
		$fichero = get_attached_file( $id );
		if ( ! $fichero || ! is_file( $fichero ) ) {
			$parte['motivo'] = 'el archivo no está donde dice el adjunto';
			return $parte;
		}
		$meta    = wp_get_attachment_metadata( $id );
		$carpeta = dirname( $fichero );
		$trabajo = [ 'full' => [ 'file' => basename( $fichero ), 'width' => (int) ( $meta['width'] ?? 0 ) ] ];
		foreach ( (array) ( $meta['sizes'] ?? [] ) as $nombre => $datos ) {
			if ( empty( $datos['file'] ) || (int) ( $datos['width'] ?? 0 ) < 32 ) {
				continue;
			}
			$trabajo[ $nombre ] = [ 'file' => (string) $datos['file'], 'width' => (int) $datos['width'] ];
		}

		$mapa = [];
		foreach ( $mimes as $mime ) {
			foreach ( $trabajo as $nombre => $datos ) {
				$origen = $carpeta . '/' . $datos['file'];
				if ( ! is_file( $origen ) ) {
					continue;
				}
				$destino = self::destino( $origen, $mime );
				$pesaba  = (int) filesize( $origen );
				if ( ! self::convertir( $origen, $destino, $mime ) ) {
					continue;
				}
				$pesa = (int) filesize( $destino );
				// Si la versión «mejor» pesa más, no es mejor.
				if ( $pesa >= $pesaba ) {
					wp_delete_file( $destino );
					continue;
				}
				$ancho = $datos['width'] ?: self::ancho_de( $destino );
				if ( ! $ancho ) {
					wp_delete_file( $destino );
					continue;
				}
				$mapa[ $mime ][ $nombre ] = [
					'file'  => basename( $destino ),
					'width' => (int) $ancho,
					'bytes' => $pesa,
				];
				$parte['hechas']++;
				$parte['antes']   += $pesaba;
				$parte['despues'] += $pesa;
			}
		}
		update_post_meta( $id, self::META, $mapa );
		if ( ! $parte['hechas'] && '' === $parte['motivo'] ) {
			$parte['motivo'] = 'no se ganaba nada convirtiéndola';
		}
		return $parte;
	}

	/**
	 * El `srcset` de un formato, listo para un `<source>`.
	 *
	 * Se arma con lo apuntado en el adjunto: ni una llamada al disco.
	 */
	public static function srcset( int $id, string $mime ): string {
		$mapa = get_post_meta( $id, self::META, true );
		if ( ! is_array( $mapa ) || empty( $mapa[ $mime ] ) ) {
			return '';
		}
		$base = self::url_base( $id );
		if ( '' === $base ) {
			return '';
		}
		$trozos = [];
		$vistos = [];
		foreach ( (array) $mapa[ $mime ] as $datos ) {
			$ancho = (int) ( $datos['width'] ?? 0 );
			$file  = (string) ( $datos['file'] ?? '' );
			if ( ! $ancho || '' === $file || isset( $vistos[ $ancho ] ) ) {
				continue;
			}
			$vistos[ $ancho ] = true;
			$trozos[ $ancho ] = esc_url( $base . '/' . $file ) . ' ' . $ancho . 'w';
		}
		ksort( $trozos );
		return implode( ', ', $trozos );
	}

	/** Cuántas fotos hay y cuántas están preparadas. */
	public static function estado(): array {
		$todas = get_posts(
			[
				'post_type'      => 'attachment',
				'post_mime_type' => [ 'image/jpeg', 'image/png' ],
				'post_status'    => 'inherit',
				'posts_per_page' => -1,
				'fields'         => 'ids',
			]
		);
		$pendientes = [];
		foreach ( (array) $todas as $id ) {
			if ( '' === get_post_meta( (int) $id, self::META, true ) ) {
				$pendientes[] = (int) $id;
			}
		}
		return [
			'fotos'      => count( (array) $todas ),
			'pendientes' => count( $pendientes ),
			'ids'        => $pendientes,
			'formatos'   => self::soportados(),
		];
	}

	/** Una tanda: ni tan corta que tarde una eternidad, ni tan larga que caduque. */
	public static function tanda( int $cuantas = 8 ): array {
		$estado = self::estado();
		$parte  = [
			'hechas'     => 0,
			'antes'      => 0,
			'despues'    => 0,
			'pendientes' => 0,
		];
		foreach ( array_slice( $estado['ids'], 0, max( 1, min( 40, $cuantas ) ) ) as $id ) {
			$uno               = self::preparar( (int) $id );
			$parte['hechas']  += $uno['hechas'];
			$parte['antes']   += $uno['antes'];
			$parte['despues'] += $uno['despues'];
		}
		$parte['pendientes'] = count( self::estado()['ids'] );
		return $parte;
	}

	/* ---------------------------------------------------------------- */

	/** Dónde viven los archivos de este adjunto. */
	private static function carpeta( int $id ): string {
		$fichero = get_attached_file( $id );
		return $fichero ? dirname( $fichero ) : '';
	}

	/** La dirección pública de esa misma carpeta. */
	private static function url_base( int $id ): string {
		$meta = wp_get_attachment_metadata( $id );
		$rel  = (string) ( $meta['file'] ?? '' );
		$subs = wp_get_upload_dir();
		$base = (string) ( $subs['baseurl'] ?? '' );
		if ( '' === $base ) {
			return '';
		}
		$dir = ltrim( dirname( $rel ), '.' );
		return '' === $dir || '/' === $dir ? $base : $base . '/' . trim( $dir, '/' );
	}

	/** `foto-800x600.jpg` → `foto-800x600.webp`, en la misma carpeta. */
	private static function destino( string $origen, string $mime ): string {
		$ext = 'image/avif' === $mime ? 'avif' : 'webp';
		return preg_replace( '/\.[A-Za-z0-9]+$/', '', $origen ) . '.' . $ext;
	}

	private static function ancho_de( string $ruta ): int {
		$t = @getimagesize( $ruta ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		return is_array( $t ) ? (int) $t[0] : 0;
	}

	/**
	 * La conversión en sí.
	 *
	 * Primero se intenta con el editor de imágenes de WordPress, que es
	 * quien sabe si aquí manda Imagick o GD y respeta los filtros de
	 * calidad del sitio. Si ese camino no existe —un entorno de pruebas,
	 * un WordPress viejo—, se hace con GD a mano.
	 */
	private static function convertir( string $origen, string $destino, string $mime ): bool {
		$calidad = (int) apply_filters( 'krg_image_quality', 82, $mime );

		if ( function_exists( 'wp_get_image_editor' ) ) {
			$editor = wp_get_image_editor( $origen );
			if ( $editor && ! is_wp_error( $editor ) ) {
				$editor->set_quality( $calidad );
				$guardado = $editor->save( $destino, $mime );
				if ( ! is_wp_error( $guardado ) && is_file( $destino ) ) {
					return true;
				}
			}
		}

		$tipo = @getimagesize( $origen ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		if ( ! is_array( $tipo ) ) {
			return false;
		}
		$lienzo = null;
		if ( 'image/jpeg' === $tipo['mime'] && function_exists( 'imagecreatefromjpeg' ) ) {
			$lienzo = @imagecreatefromjpeg( $origen ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		} elseif ( 'image/png' === $tipo['mime'] && function_exists( 'imagecreatefrompng' ) ) {
			$lienzo = @imagecreatefrompng( $origen ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
			if ( $lienzo ) {
				imagepalettetotruecolor( $lienzo );
				imagealphablending( $lienzo, true );
				imagesavealpha( $lienzo, true );
			}
		}
		if ( ! $lienzo ) {
			return false;
		}
		$ok = false;
		if ( 'image/avif' === $mime && function_exists( 'imageavif' ) ) {
			$ok = @imageavif( $lienzo, $destino, $calidad ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		} elseif ( 'image/webp' === $mime && function_exists( 'imagewebp' ) ) {
			$ok = @imagewebp( $lienzo, $destino, $calidad ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}
		imagedestroy( $lienzo );
		return (bool) $ok && is_file( $destino );
	}
}
