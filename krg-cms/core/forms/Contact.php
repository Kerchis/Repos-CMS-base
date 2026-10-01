<?php
/**
 * Contact form handler.
 *
 * @package Meridian
 */

namespace Meridian\Forms;

defined( 'ABSPATH' ) || exit;

class Contact {

	public static function handle(): void {
		$nonce = sanitize_text_field( wp_unslash( $_POST['krg_nonce'] ?? $_POST['meridian_nonce'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
		if ( ! wp_verify_nonce( $nonce, 'krg_contact' ) && ! wp_verify_nonce( $nonce, 'meridian_contact' ) ) {
			wp_send_json_error( [ 'message' => __( 'La sesión no es válida. Recarga la página.', 'meridian' ) ], 403 );
		}
		if ( ! empty( $_POST['website'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			wp_send_json_success( [ 'message' => __( 'Mensaje enviado. Gracias.', 'meridian' ) ] );
		}
		$name    = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
		$email   = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
		$phone   = sanitize_text_field( wp_unslash( $_POST['phone'] ?? '' ) );
		$subject = sanitize_text_field( wp_unslash( $_POST['subject'] ?? '' ) );
		$message = sanitize_textarea_field( wp_unslash( $_POST['message'] ?? '' ) );

		if ( ! $name || ! is_email( $email ) || ! $message ) {
			wp_send_json_error( [ 'message' => __( 'Revisa los campos obligatorios.', 'meridian' ) ], 400 );
		}

		$to      = get_option( 'admin_email' );
		$subj    = $subject ? $subject : sprintf( __( 'Contacto de %s', 'meridian' ), $name );
		$body    = "Nombre: {$name}\nEmail: {$email}\nTeléfono: {$phone}\n\n{$message}";
		$headers = [ 'Reply-To: ' . $name . ' <' . $email . '>' ];
		$sent    = wp_mail( $to, $subj, $body, $headers );
		if ( ! $sent ) {
			\Meridian\Log\Logger::error( 'contact_mail_failed', [ 'email' => $email ] );
			wp_send_json_error( [ 'message' => __( 'No se pudo enviar el mensaje.', 'meridian' ) ], 500 );
		}
		wp_send_json_success( [ 'message' => __( 'Mensaje enviado. Gracias.', 'meridian' ) ] );
	}
}
