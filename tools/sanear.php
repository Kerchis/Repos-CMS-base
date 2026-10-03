<?php
/**
 * Pasa un documento por el saneador real y lo devuelve como JSON.
 *
 * Por que existe: el banco del constructor (`prueba-motor.mjs`) simulaba
 * el servidor devolviendo tal cual lo que el navegador le mandaba. Eso
 * hace que el banco no pueda ver ni una sola cosa de las que el servidor
 * descarta, recorta o reescribe al guardar —y el fallo que motivo esta
 * herramienta vivia justo ahi: en la forma del JSON que devuelve PHP.
 *
 * Con esto el servidor falso del banco hace lo mismo que WordPress:
 *
 *   POST → Sanitizer::document() → wp_json_encode → respuesta
 *
 * incluida la codificacion, que es donde un diccionario vacio se
 * convierte en `[]` y deja de ser escribible desde el navegador.
 *
 *   .tools/php/php tools/sanear.php documento.json
 */

define( 'ABSPATH', __DIR__ . '/' );

require __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/components/Catalog.php';
require_once $base . '/core/components/BrandCatalog.php';
require_once $base . '/core/components/Registry.php';
require_once $base . '/core/security/Sanitizer.php';
require_once $base . '/core/style/BoxStyles.php';
require_once $base . '/core/security/UrlValidator.php';
require_once $base . '/core/design/TokenCompiler.php';
require_once $base . '/core/content/Document.php';

\Meridian\Components\Registry::boot();

$archivo = $argv[1] ?? '';
$raw     = $archivo ? file_get_contents( $archivo ) : file_get_contents( 'php://stdin' );
$doc     = json_decode( (string) $raw, true );
if ( ! is_array( $doc ) ) {
	fwrite( STDERR, "documento ilegible\n" );
	exit( 1 );
}

$limpio = \Meridian\Security\Sanitizer::document( $doc );

// La lectura tambien pasa por aqui: es lo que hace PageRepository::get()
// antes de contestar a la API.
$limpio = \Meridian\Style\BoxStyles::migrate_document( $limpio );

echo wp_json_encode( $limpio );
