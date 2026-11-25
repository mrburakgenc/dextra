// Oturum denetimi komutu: kimlik guard'ının ortak koddaki sözleşmeyle verdiği oturum kimliği ve imzası
// doğrulanmış adres bilgisi (TS-002 "Yapı"). İstek gövdesinden gelmediği için şeması yoktur. Komuttur,
// çünkü adres değişince oturumu kapatır.
import type { OturumDenetimiGirdisi } from '../../../../../../shared/kimlik/oturum-denetimi.contract.js';

export type OturumDenetimiKomutu = OturumDenetimiGirdisi;
