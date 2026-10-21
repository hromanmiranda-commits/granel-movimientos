#!/usr/bin/env python3
"""
Script para conectar vía IMAP al correo de Hostinger (@inversioneshr.cl),
buscar correos de facturasersa@azuriandte.com, descargar adjuntos PDF a
las carpetas correspondientes y procesar las cargas de ENAP en 'Ventas Granel.xlsx'.
"""

import os
import sys
import email
from email.header import decode_header
import imaplib
import json

from procesar_enap import (
    clasificar_documento,
    extraer_datos_factura,
    extraer_datos_guia,
    registrar_carga_enap_excel
)

CONFIG_FILE = "config_email.json"
DIR_GUIAS = "documentos/guias"
DIR_FACTURAS = "documentos/facturas"


def cargar_configuracion():
    if not os.path.exists(CONFIG_FILE):
        plantilla = {
            "servidor_imap": "imap.hostinger.com",
            "puerto_imap": 993,
            "correo": "tu_correo@inversioneshr.cl",
            "password": "tu_password_aqui",
            "remitente_filtro": "facturasersa@azuriandte.com"
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(plantilla, f, indent=4, ensure_ascii=False)
        print(f"⚠️ Se ha creado el archivo de configuración '{CONFIG_FILE}'.")
        print("Por favor, ingresa tu correo y contraseña en ese archivo antes de continuar.")
        return None

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def decodificar_texto(texto_codificado):
    if not texto_codificado:
        return ""
    partes = decode_header(texto_codificado)
    resultado = ""
    for texto, encoding in partes:
        if isinstance(texto, bytes):
            try:
                resultado += texto.decode(encoding or "utf-8", errors="ignore")
            except Exception:
                resultado += texto.decode("latin-1", errors="ignore")
        else:
            resultado += str(texto)
    return resultado


def sincronizar_correos():
    config = cargar_configuracion()
    if not config:
        return

    os.makedirs(DIR_GUIAS, exist_ok=True)
    os.makedirs(DIR_FACTURAS, exist_ok=True)

    servidor = config.get("servidor_imap", "imap.hostinger.com")
    puerto = config.get("puerto_imap", 993)
    usuario = config.get("correo")
    password = config.get("password")
    filtro_from = config.get("remitente_filtro", "facturasersa@azuriandte.com")

    if "tu_password_aqui" in password or "tu_correo" in usuario:
        print(f"⚠️ Debes configurar tus credenciales reales en '{CONFIG_FILE}'.")
        return

    print("==================================================")
    print(f" Conectando a {servidor} ({usuario})...")
    print("==================================================")

    try:
        mail = imaplib.IMAP4_SSL(servidor, puerto)
        mail.login(usuario, password)
        mail.select("INBOX")
        print("✓ Conexión establecida exitosamente.")
    except Exception as e:
        print(f"❌ Error de conexión al correo: {e}")
        return

    criterio = f'(FROM "{filtro_from}")'
    status, messages = mail.search(None, criterio)
    if status != "OK" or not messages[0]:
        print(f"ℹ️ No se encontraron correos nuevos de {filtro_from}.")
        mail.logout()
        return

    ids_correos = messages[0].split()
    print(f"📧 Se encontraron {len(ids_correos)} correos de {filtro_from}.")

    guias_procesadas = {}
    facturas_procesadas = {}

    for msg_id in ids_correos:
        res, data = mail.fetch(msg_id, "(RFC822)")
        if res != "OK":
            continue

        raw_email = data[0][1]
        msg = email.message_from_bytes(raw_email)

        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if part.get("Content-Disposition") is None:
                continue

            filename = part.get_filename()
            if not filename:
                continue

            filename = decodificar_texto(filename).strip()
            if not filename.lower().endswith(".pdf"):
                continue

            contenido = part.get_payload(decode=True)
            if not contenido:
                continue

            # Guardar temporalmente para clasificar por contenido
            temp_path = os.path.join("documentos", filename)
            with open(temp_path, "wb") as f:
                f.write(contenido)

            tipo = clasificar_documento(temp_path)
            if tipo == "FACTURA":
                dest_path = os.path.join(DIR_FACTURAS, filename)
                os.replace(temp_path, dest_path)
                try:
                    df = extraer_datos_factura(dest_path)
                    if df.get("numero_guia"):
                        facturas_procesadas[df["numero_guia"]] = df
                except Exception as e:
                    print(f"   ⚠️ Error leyendo factura {filename}: {e}")
            elif tipo == "GUIA":
                dest_path = os.path.join(DIR_GUIAS, filename)
                os.replace(temp_path, dest_path)
                try:
                    dg = extraer_datos_guia(dest_path)
                    if dg.get("numero_guia"):
                        guias_procesadas[dg["numero_guia"]] = dg
                except Exception as e:
                    print(f"   ⚠️ Error leyendo guía {filename}: {e}")
            else:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

    mail.logout()

    # Procesar también los que ya estaban descargados en las carpetas
    for f in os.listdir(DIR_GUIAS):
        if f.lower().endswith(".pdf"):
            p = os.path.join(DIR_GUIAS, f)
            t = clasificar_documento(p)
            if t == "FACTURA":
                # Mover a facturas
                n_path = os.path.join(DIR_FACTURAS, f)
                os.replace(p, n_path)
                df = extraer_datos_factura(n_path)
                if df.get("numero_guia"):
                    facturas_procesadas[df["numero_guia"]] = df
            elif t == "GUIA":
                dg = extraer_datos_guia(p)
                if dg.get("numero_guia"):
                    guias_procesadas[dg["numero_guia"]] = dg

    for f in os.listdir(DIR_FACTURAS):
        if f.lower().endswith(".pdf"):
            p = os.path.join(DIR_FACTURAS, f)
            df = extraer_datos_factura(p)
            if df.get("numero_guia"):
                facturas_procesadas[df["numero_guia"]] = df

    # Cruzar datos por N° Guía y registrar en Excel
    print("\n==================================================")
    print(" Sincronizando compras cruzadas con Excel...")
    print("==================================================")

    nuevas_cargas = 0
    todas_guias = sorted(list(set(list(guias_procesadas.keys()) + list(facturas_procesadas.keys()))))

    for n_guia in todas_guias:
        guia = guias_procesadas.get(n_guia)
        factura = facturas_procesadas.get(n_guia)

        if guia and factura:
            fecha = guia['fecha'] or factura['fecha']
            camion = guia['camion'] or "VJYL61"
            monto_total = factura['valor_total'] or (factura['valor_neto'] * 1.19 if factura['valor_neto'] else 0)
            litros = guia['litros'] or 0
            toneladas = factura.get('toneladas')

            if litros > 0 and monto_total > 0:
                registrado = registrar_carga_enap_excel(
                    fecha=fecha,
                    camion=camion,
                    n_guia=n_guia,
                    monto_total_iva=monto_total,
                    litros_comprados=litros,
                    toneladas=toneladas
                )
                if registrado:
                    nuevas_cargas += 1
        elif guia and not factura:
            pass
        elif factura and not guia:
            pass

    if nuevas_cargas > 0:
        print(f"\n🚀 Se agregaron {nuevas_cargas} compras nuevas a Ventas Granel.xlsx!")
        print("Actualizando presentación web...")
        os.system("./venv/bin/python update_presentation.py")
    else:
        print("\n✓ No hubo nuevas cargas pendientes por registrar (todo al día).")


if __name__ == "__main__":
    sincronizar_correos()
