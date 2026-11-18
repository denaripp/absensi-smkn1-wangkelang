// Template impor siswa: kolom nisn, nama, kelas (nama kelas harus sama persis dengan yang ada di sistem).
const path = require('node:path')
const XLSX = require('xlsx')

const isi = [
  ['nisn', 'nama', 'kelas'],
  ['0061234510', 'Contoh Siswa Satu', 'XII RPL 1'],
  ['0061234511', 'Contoh Siswa Dua', 'XII RPL 1'],
]

const lembar = XLSX.utils.aoa_to_sheet(isi)
lembar['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }]
const buku = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(buku, lembar, 'Siswa')

const tujuan = path.join(process.cwd(), 'template-siswa.xlsx')
XLSX.writeFile(buku, tujuan)
console.log('Template dibuat:', tujuan)
