// Rolleri listele işinin sonucu: isteyenin görebildiği kolonlarla canlı rollerin bir sayfası.
import type { RolGorunumu } from '../../../domain/repositories/i-rol.repository.js';
import type { ListeCevabi } from '../../_shared/liste.js';

export type RolListeleSonucu = ListeCevabi<RolGorunumu>;
