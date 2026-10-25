-- No show : le prospect n'est pas venu au rendez-vous (exclu des RDV pris dans les stats).
ALTER TYPE "EchangeType" ADD VALUE IF NOT EXISTS 'NO_SHOW';
ALTER TYPE "RdvResultat" ADD VALUE IF NOT EXISTS 'NO_SHOW';
