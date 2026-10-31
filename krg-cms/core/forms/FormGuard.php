<?php
/**
 * Guardia común de los formularios públicos: freno de envíos y
 * cabeceras de correo bien armadas.
 *
 * Los dos formularios que escuchan sin sesión —contacto y reserva—
 * comparten los mismos dos problemas, así que comparten la solución.
 *
 * @package Meridian
 */

namespace Meridian\Forms;

defined( 'ABSPATH' ) || exit;

class FormGuard {

	/** Envíos por cliente (IP + navegador) dentro de la ventana. */
	public const TOPE_CLIENTE = 6;

	/**
	 * Techo por IP. Más ancho que el del cliente para no castigar a una
	 * oficina entera detrás del mismo router, pero presente: cambiar de
	 * User-Agent no multiplica el cupo.
	 */
	public const TOPE_IP = 30;

	/** Cuando no hay IP que contar, un cubo común. Ancho, pero cubo. */
	public const TOPE_SIN_IP = 60;

	/** La ventana, en segundos. */
	public const VENTANA = 600;

	/** Segundos mínimos entre dos envíos del mismo cliente. */
	public const MINIMO = 5;

	/**
	 * La dirección del que llama.
	 *
	 * Sólo `REMOTE_ADDR`. Las cabeceras tipo `X-Forwarded-For` las puede
	 * escribir cualquiera: leerlas de serie convierte el freno en un
	 * adorno, porque basta inventarse una dirección distinta en cada
	 * envío. Quien esté detrás de Cloudflare o de un balanceador conecta
	 * el filtro `krg_client_ip` a sabiendas y bajo su responsabilidad.
	 */
	public static function ip(): string {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		$ip = (string) apply_filters( 'krg_client_ip', $ip );
		return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '';
	}

	/**
	 * ¿Dejamos pasar este envío?
	 *
	 * @param string $ambito Nombre del formulario, para que contacto y
	 *                       reserva no compartan cupo.
	 */
	public static function permite( string $ambito ): bool {
		$ip = self::ip();
		if ( '' === $ip ) {
			// Sin IP no hay a quién contar: cubo común y más holgado,
			// pero nunca barra libre (antes aquí se devolvía `true`).
			return self::cubo( $ambito . '|sin-ip', self::TOPE_SIN_IP, false );
		}

		$ua = isset( $_SERVER['HTTP_USER_AGENT'] )
			? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 )
			: '';

		if ( ! self::cubo( $ambito . '|c|' . $ip . '|' . $ua, self::TOPE_CLIENTE, true ) ) {
			return false;
		}
		return self::cubo( $ambito . '|i|' . $ip, self::TOPE_IP, false );
	}

	/**
	 * Un cubo con cuenta y sello de tiempo.
	 *
	 * La ventana es deslizante: cada envío aceptado renueva la caducidad.
	 * Es deliberado —así una tanda sostenida no se libera sola— y es la
	 * lectura estricta de las dos.
	 *
	 * @param string $clave    Identificador del cubo.
	 * @param int    $tope     Envíos permitidos en la ventana.
	 * @param bool   $espaciar Exigir además `MINIMO` segundos entre envíos.
	 */
	private static function cubo( string $clave, int $tope, bool $espaciar ): bool {
		$k    = 'krg_fg_' . md5( $clave );
		$dato = get_transient( $k );
		$n    = is_array( $dato ) ? (int) ( $dato['n'] ?? 0 ) : 0;
		$t    = is_array( $dato ) ? (int) ( $dato['t'] ?? 0 ) : 0;

		$ahora = time();
		if ( $espaciar && $t > 0 && ( $ahora - $t ) < self::MINIMO ) {
			return false;
		}
		if ( $n >= $tope ) {
			return false;
		}
		set_transient( $k, [ 'n' => $n + 1, 't' => $ahora ], self::VENTANA );
		return true;
	}

	/**
	 * La cabecera `Reply-To`, armada sin confiar en nadie.
	 *
	 * Una cabecera de correo se parte con un `\r\n`, y por esa grieta se
	 * cuela un `Bcc:` ajeno. Hoy `sanitize_text_field` ya quita los
	 * saltos de línea aguas arriba, pero eso es un efecto secundario de
	 * un saneador que vive en otro archivo: el día que cambie, esto se
	 * convierte en inyección de cabeceras sin que nadie lo note. Así que
	 * se limpia aquí, donde se usa.
	 *
	 * @return string La cabecera, o cadena vacía si el correo no vale.
	 */
	public static function reply_to( string $nombre, string $email ): string {
		$email = sanitize_email( $email );
		if ( ! is_email( $email ) ) {
			return '';
		}
		$nombre = (string) preg_replace( '/[\r\n\t\0]+/', ' ', wp_strip_all_tags( $nombre ) );
		$nombre = str_replace( [ '"', '<', '>', ',', ';', ':', '(', ')', '@', '\\' ], '', $nombre );
		$nombre = trim( preg_replace( '/\s+/', ' ', $nombre ) );
		if ( function_exists( 'mb_substr' ) ) {
			$nombre = trim( mb_substr( $nombre, 0, 78 ) );
		} else {
			$nombre = trim( substr( $nombre, 0, 78 ) );
		}
		if ( '' === $nombre ) {
			return 'Reply-To: ' . $email;
		}
		return 'Reply-To: "' . $nombre . '" <' . $email . '>';
	}
}
