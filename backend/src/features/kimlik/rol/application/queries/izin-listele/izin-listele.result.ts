// İzinleri listele işinin sonucu: isteyenin görebildiği kolonlarla izin kataloğunun bir sayfası.
import type { IzinGorunumu } from '../../../domain/repositories/i-rol.repository.js';
import type { ListeCevabi } from '../../_shared/liste.js';

export type IzinListeleSonucu = ListeCevabi<IzinGorunumu>;
