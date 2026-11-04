-- Un administrateur qui est aussi commercial (Bilel) peut se mettre en simple commercial depuis ses paramètres.
ALTER TABLE "User" ADD COLUMN "roleActif" "Role";
