<?php
/**
 * Escribe las declaraciones de caja de un estado, leido de la entrada
 * estandar como JSON. Existe para que el banco pueda comparar, letra por
 * letra, lo que genera el PHP con lo que genera el editor.
 *
 *   echo '{"padding-top":"10px"}' | .tools/php/php tools/caja-php.php
 *
 * @package Meridian
 */

define( 'ABSPATH', __DIR__ );
require_once dirname( __DIR__ ) . '/krg-cms/core/style/BoxStyles.php';

$in = json_decode( (string) file_get_contents( 'php://stdin' ), true );
echo implode( ';', \Meridian\Style\BoxStyles::declarations( is_array( $in ) ? $in : [] ) );
