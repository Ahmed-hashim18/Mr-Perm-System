import { ClientItem, Transaction, OrderEntry } from '../types/treasury';

/**
 * Exact clients from the Google Sheet 'Clients' tab
 * shown in user's screenshot
 */
export const INITIAL_CLIENTS: ClientItem[] = [
  { id: 'cli-c01', code: 'C01', name: 'Owner', fullLabel: 'C01 - Owner' },
  { id: 'cli-c02', code: 'C02', name: 'انجي', remaining: 120271825, fullLabel: 'C02 - انجي' },
  { id: 'cli-c03', code: 'C03', name: 'انهار', remaining: 3480000, fullLabel: 'C03 - انهار' },
  { id: 'cli-c04', code: 'C04', name: 'الاماسي', remaining: 78479942, fullLabel: 'C04 - الاماسي' },
  { id: 'cli-c05', code: 'C05', name: 'أم درمان الطبية', fullLabel: 'C05 - أم درمان الطبية' },
  { id: 'cli-c06', code: 'C06', name: 'الرياض', remaining: 14336745, fullLabel: 'C06 - الرياض' },
  { id: 'cli-c07', code: 'C07', name: 'الشهباء', fullLabel: 'C07 - الشهباء' },
  { id: 'cli-c08', code: 'C08', name: 'الشريف', remaining: 6000000, fullLabel: 'C08 - الشريف' },
  { id: 'cli-c09', code: 'C09', name: 'الصناعات', fullLabel: 'C09 - الصناعات' },
  { id: 'cli-c10', code: 'C10', name: 'الفاضلابي', fullLabel: 'C10 - الفاضلابي' },
  { id: 'cli-c11', code: 'C11', name: 'اليقين', remaining: 27163600, fullLabel: 'C11 - اليقين' },
  { id: 'cli-c12', code: 'C12', name: 'بشار', fullLabel: 'C12 - بشار' },
  { id: 'cli-c13', code: 'C13', name: 'دان مروي', remaining: 8211000, fullLabel: 'C13 - دان مروي' },
  { id: 'cli-c14', code: 'C14', name: 'ذر فارما', remaining: 6780947, fullLabel: 'C14 - ذر فارما' },
  { id: 'cli-c15', code: 'C15', name: 'شركة دوني', remaining: 7165200, fullLabel: 'C15 - شركة دوني' },
  { id: 'cli-c16', code: 'C16', name: 'رقية فارما', remaining: 5757420, fullLabel: 'C16 - رقية فارما' },
  { id: 'cli-c17', code: 'C17', name: 'سبلاي كير', fullLabel: 'C17 - سبلاي كير' },
  { id: 'cli-c18', code: 'C18', name: 'شركة طه', remaining: 2000000, fullLabel: 'C18 - شركة طه' },
  { id: 'cli-c19', code: 'C19', name: 'شفق', remaining: 2994640, fullLabel: 'C19 - شفق' },
  { id: 'cli-c20', code: 'C20', name: 'كجرس', remaining: 2210500, fullLabel: 'C20 - كجرس' },
  { id: 'cli-c21', code: 'C21', name: 'ليليام', fullLabel: 'C21 - ليليام' },
  { id: 'cli-c22', code: 'C22', name: 'محظوظ باوقة', fullLabel: 'C22 - محظوظ باوقة' },
  { id: 'cli-c23', code: 'C23', name: 'محمد الطيب', remaining: 4605000, fullLabel: 'C23 - محمد الطيب' },
  { id: 'cli-c24', code: 'C24', name: 'محمد معاوية', fullLabel: 'C24 - محمد معاوية' },
  { id: 'cli-c25', code: 'C25', name: 'محمد هلال', remaining: 21344500, fullLabel: 'C25 - محمد هلال' },
  { id: 'cli-c26', code: 'C26', name: 'ميديكال بلص', remaining: 17320810, fullLabel: 'C26 - ميديكال بلص' },
  { id: 'cli-c27', code: 'C27', name: 'مؤيد ألترا ماكس', fullLabel: 'C27 - مؤيد ألترا ماكس' },
  { id: 'cli-c28', code: 'C28', name: 'موسي تجميل', fullLabel: 'C28 - موسي تجميل' },
  { id: 'cli-c29', code: 'C29', name: 'CDC', remaining: 11755633, fullLabel: 'C29 - CDC' },
  { id: 'cli-c30', code: 'C30', name: 'درر', fullLabel: 'C30 - درر' },
  { id: 'cli-c31', code: 'C31', name: 'سيلال كير', fullLabel: 'C31 - سيلال كير' },
  { id: 'cli-c32', code: 'C32', name: 'درر', fullLabel: 'C32 - درر' },
  { id: 'cli-c33', code: 'C33', name: 'TEST', fullLabel: 'C33 - TEST' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_OPENING_BALANCE = 0;
 
export const INITIAL_ORDERS: OrderEntry[] = [];

