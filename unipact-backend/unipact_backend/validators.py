"""Upload checks shared by every endpoint that accepts files."""
from pathlib import Path

from django.conf import settings
from rest_framework import serializers

# Verification documents: student IDs, SSM certificates, club letters
DOCUMENT_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.webp'}

# Project files: briefs, brand assets, raw footage, audio stems and deliverables
PROJECT_FILE_EXTENSIONS = DOCUMENT_EXTENSIONS | {
    '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.txt', '.md',
    '.zip', '.rar', '.7z',
    # No SVG: it can carry scripts. Designers can send logos as PNG, AI, EPS or PDF.
    '.gif', '.ai', '.psd', '.eps', '.fig', '.sketch',
    '.mp4', '.mov', '.m4v', '.webm', '.avi',
    '.mp3', '.wav', '.m4a', '.aac', '.flac',
}

# Never accept anything a browser or server could execute, even if renamed into an allowed list later
BLOCKED_EXTENSIONS = {
    '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.sh', '.js', '.mjs', '.jar',
    '.html', '.htm', '.svg', '.php', '.py', '.dll', '.apk', '.app', '.vbs',
}

# Signatures of executables / HTML that should never arrive disguised as a document
DANGEROUS_SIGNATURES = (b'MZ', b'\x7fELF', b'<!doctype html', b'<html', b'<script')


def _check(file_obj, allowed_extensions, max_mb, label):
    if file_obj is None:
        return file_obj

    name = getattr(file_obj, 'name', '') or ''
    suffixes = [s.lower() for s in Path(name).suffixes]
    extension = suffixes[-1] if suffixes else ''

    if not extension or any(s in BLOCKED_EXTENSIONS for s in suffixes):
        raise serializers.ValidationError(f'{label}: this file type is not allowed.')
    if extension not in allowed_extensions:
        allowed = ', '.join(sorted(e.lstrip('.').upper() for e in allowed_extensions))
        raise serializers.ValidationError(f'{label}: please upload one of these file types: {allowed}.')

    size = getattr(file_obj, 'size', 0) or 0
    if size == 0:
        raise serializers.ValidationError(f'{label}: the file is empty.')
    if size > max_mb * 1024 * 1024:
        raise serializers.ValidationError(f'{label}: files can be at most {max_mb} MB.')

    head = file_obj.read(512)
    file_obj.seek(0)
    if head.lstrip().lower().startswith(DANGEROUS_SIGNATURES):
        raise serializers.ValidationError(f'{label}: this file type is not allowed.')

    return file_obj


def validate_document_upload(file_obj, label='Document'):
    return _check(file_obj, DOCUMENT_EXTENSIONS, settings.MAX_DOCUMENT_UPLOAD_MB, label)


def validate_project_file_upload(file_obj, label='File'):
    return _check(file_obj, PROJECT_FILE_EXTENSIONS, settings.MAX_PROJECT_FILE_UPLOAD_MB, label)
