"""Regenerate synthetic PDFs: python generate-fixtures.py /path/to/unicode-font.ttf."""
import base64
import io
import json
import pathlib
import sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter

root = pathlib.Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('Fixture', sys.argv[1]))
buffer = io.BytesIO()
c = canvas.Canvas(buffer, pagesize=(600, 800), invariant=1)
for index in range(3):
    c.setPageSize((600 if index != 1 else 800, 800 if index != 1 else 600))
    c.setFont('Fixture', 18)
    c.drawString(48, 500, 'PDF reader test / Тест читання')
    c.setFont('Fixture', 14)
    c.drawString(48, 450, 'Local search: alpha beta alpha.')
    c.drawString(48, 415, 'Пошук: книга, сторінка, книга.')
    c.drawString(48, 380, 'A phrase across')
    c.drawString(48, 360, 'two lines.')
    c.drawString(48, 80, f'Page {index + 1}')
    c.showPage()
c.save()
reader = PdfReader(buffer)
writer = PdfWriter()
for index, page in enumerate(reader.pages):
    if index == 2:
        page.rotate(90)
    writer.add_page(page)
output = io.BytesIO()
writer.write(output)
content = output.getvalue()
(root / 'fixtures/text.pdf').write_bytes(content)
(root / 'src/fixture.ts').write_text('// Generated from fixtures/text.pdf; synthetic data only.\nexport const fixtureBase64 = ' + json.dumps(base64.b64encode(content).decode()) + ';\n')
(root / 'fixtures/expected.json').write_text(json.dumps({'pages': 3, 'queries': {'alpha': 6, 'книга': 6}, 'rotatedPage': 3}, ensure_ascii=False, indent=2) + '\n')

# Image-only document: visually meaningful pixels, no searchable text layer.
from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader
image = Image.new('RGB', (600, 800), 'white')
drawing = ImageDraw.Draw(image)
drawing.rectangle((40, 40, 560, 760), outline='navy', width=8)
drawing.text((80, 120), 'Synthetic scanned page - alpha', fill='black')
scan_buffer = io.BytesIO()
scan_canvas = canvas.Canvas(scan_buffer, pagesize=(600, 800), invariant=1)
scan_canvas.drawImage(ImageReader(image), 0, 0, width=600, height=800)
scan_canvas.save()
protected = PdfWriter()
protected.clone_document_from_reader(PdfReader(io.BytesIO(content)))
protected.encrypt('reader-test')
protected_buffer = io.BytesIO()
protected.write(protected_buffer)
variants = {
    'password': protected_buffer.getvalue(),
    'scan': scan_buffer.getvalue(),
    'corrupt': b'%PDF-1.7\ncorrupted fixture\n',
}
for name, data in variants.items():
    (root / f'fixtures/{name}.pdf').write_bytes(data)
(root / 'src/qa-fixtures.ts').write_text(
    '// Generated synthetic local QA fixtures. Never include user documents.\n'
    'export const qaFixtures = ' + json.dumps({
        name: base64.b64encode(data).decode() for name, data in variants.items()
    }, indent=2) + ';\n'
)
