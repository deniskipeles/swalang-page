export  const formatDate = (date: string|null|undefined) =>new Date(date??'').toLocaleDateString()
export function formatDateLong(date: Date | null | undefined): string {
    if (!date) return '';
    try {
        return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return 'Invalid Date';
    }
 }