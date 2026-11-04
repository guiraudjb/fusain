<#
.SYNOPSIS
    Exporte d'HPE IMC, par son API REST, les liens et les équipements au format lu par FUSAIN.

.DESCRIPTION
    Interroge IMC en lecture seule (aucune modification) et écrit deux fichiers CSV :
      - reseau-liens.csv       : un lien par ligne, avec le site et le local technique de chaque extrémité.
                                 Ce fichier suffit à FUSAIN (« Importer un réseau », premier champ).
      - reseau-equipements.csv : un équipement par ligne (catégorie, IP, modèle, emplacement, site, local).
                                 Facultatif, il précise les icônes (second champ).

    Le site et le local technique viennent de l'emplacement (Location, sysLocation) de chaque équipement :
    « Paris / LT étage 1 » donne le site « Paris » et le local « LT étage 1 ». Un emplacement sans séparateur
    devient le site, sans local. Le séparateur se règle avec -Separateur.

    Compatible Windows PowerShell 5.1 et PowerShell 7. Authentification Digest d'IMC.

.PARAMETER Serveur
    Adresse d'IMC, avec le protocole et le port : http://imc.exemple.fr:8080 ou https://imc.exemple.fr:8443

.PARAMETER Identifiants
    Compte IMC autorisé sur l'API REST (System > Operator Management). Demandé s'il n'est pas fourni.

.PARAMETER VueTopologie
    Identifiant de la vue de topologie dont on lit les liens. 1 = vue IP (tout le réseau).

.PARAMETER Separateur
    Séparateur entre site et local dans l'emplacement IMC. Par défaut « / ». Chaîne vide : pas de découpage.

.PARAMETER Dossier
    Dossier où écrire les fichiers. Par défaut, le dossier courant.

.PARAMETER IgnorerCertificat
    Accepte un certificat HTTPS non reconnu (certificat auto-signé d'IMC).

.EXAMPLE
    .\Exporter-ReseauIMC.ps1 -Serveur https://imc.exemple.fr:8443 -IgnorerCertificat

.EXAMPLE
    $c = Get-Credential
    .\Exporter-ReseauIMC.ps1 -Serveur http://10.0.0.5:8080 -Identifiants $c -Separateur ';' -Dossier C:\Exports
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Serveur,
    [System.Management.Automation.PSCredential]$Identifiants,
    [int]$VueTopologie = 1,
    [string]$Separateur = '/',
    [string]$Dossier = '.',
    [switch]$IgnorerCertificat,
    [int]$TaillePage = 500
)

$ErrorActionPreference = 'Stop'
$Serveur = $Serveur.TrimEnd('/')
if (-not $Identifiants) { $Identifiants = Get-Credential -Message 'Compte IMC (lecture de l''API REST)' }
$ps7 = $PSVersionTable.PSVersion.Major -ge 6

# ---------- Connexion ----------

$options = @{ Credential = $Identifiants; Headers = @{ Accept = 'application/json' }; Method = 'Get' }
if ($ps7) {
    if ($IgnorerCertificat) { $options.SkipCertificateCheck = $true }
    # PowerShell 7 refuse d'envoyer un mot de passe en HTTP sans cette option (Digest ne le transmet pas en clair)
    if ($Serveur -like 'http:*') { $options.AllowUnencryptedAuthentication = $true }
} else {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    if ($IgnorerCertificat) { [Net.ServicePointManager]::ServerCertificateValidationCallback = { $true } }
}

function Invoke-Imc([string]$chemin) {
    try {
        return Invoke-RestMethod -Uri "$Serveur/imcrs$chemin" @options
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 401) { throw "IMC refuse le compte « $($Identifiants.UserName) » (401) : vérifiez le mot de passe et le droit d'accès à l'API REST." }
        throw "Requête IMC impossible ($Serveur/imcrs$chemin) : $($_.Exception.Message)"
    }
}

# IMC rend un objet seul au lieu d'une liste quand il n'y a qu'un résultat
function Get-Liste($reponse, [string]$nom) {
    if ($null -eq $reponse) { return @() }
    $v = $reponse.$nom
    if ($null -eq $v) { return @() }
    return @($v)
}

# Lecture page par page ; s'arrête quand une page n'apporte plus rien de nouveau (API qui ignore la pagination)
function Get-Tout([string]$chemin, [string]$nom) {
    $tout = New-Object System.Collections.ArrayList
    $vus = @{}
    $debut = 0
    while ($true) {
        $sep = if ($chemin.Contains('?')) { '&' } else { '?' }
        # @() : sous PowerShell 5.1, un objet seul n'a pas de .Count
        $page = @(Get-Liste (Invoke-Imc "$chemin${sep}start=$debut&size=$TaillePage") $nom)
        $nouveaux = 0
        foreach ($x in $page) {
            $cle = if ($x.id) { [string]$x.id } else { ($x | ConvertTo-Json -Compress -Depth 3) }
            if (-not $vus.ContainsKey($cle)) { $vus[$cle] = $true; [void]$tout.Add($x); $nouveaux++ }
        }
        if ($page.Count -lt $TaillePage -or $nouveaux -eq 0) { break }
        $debut += $TaillePage
    }
    return , $tout.ToArray()
}

# Première propriété non vide parmi plusieurs noms possibles (les champs varient selon la version d'IMC)
function Get-Champ($objet, [string[]]$noms) {
    foreach ($n in $noms) {
        $p = $objet.PSObject.Properties[$n]
        if ($p -and $null -ne $p.Value -and [string]$p.Value -ne '') { return [string]$p.Value }
    }
    return ''
}

# Catégories d'IMC (categoryId) en intitulés que FUSAIN reconnaît pour choisir l'icône
$CATEGORIES = @{
    '0' = 'Routers'; '1' = 'Switches'; '2' = 'Servers'; '3' = 'Security'; '4' = 'Storage'; '5' = 'Wireless'
    '6' = 'Voice'; '7' = 'Printers'; '8' = 'UPS'; '9' = 'Desktops'; '11' = 'Surveillance'
}

function Split-Emplacement([string]$lieu) {
    $lieu = $lieu.Trim()
    if ($Separateur -and $lieu.Contains($Separateur)) {
        $i = $lieu.IndexOf($Separateur)
        return @($lieu.Substring(0, $i).Trim(), $lieu.Substring($i + $Separateur.Length).Trim())
    }
    return @($lieu, '')
}

# ---------- Équipements ----------

Write-Host "Lecture des équipements sur $Serveur…"
$equipements = Get-Tout '/plat/res/device?resPrivilegeFilter=false&orderBy=id&desc=false&total=false' 'device'
Write-Host "  $($equipements.Count) équipements."

$parCle = @{}   # identifiant, symbole, libellé ou IP → équipement préparé
$lignesEquipements = foreach ($d in $equipements) {
    $libelle = Get-Champ $d @('label', 'sysName', 'name', 'ip')
    $lieu = Get-Champ $d @('location', 'sysLocation')
    $site, $local = Split-Emplacement $lieu
    $categorie = Get-Champ $d @('devCategory', 'categoryName')
    if (-not $categorie) { $categorie = $CATEGORIES[(Get-Champ $d @('categoryId'))] }
    $e = [pscustomobject][ordered]@{
        'Device Label'    = $libelle
        'IP Address'      = Get-Champ $d @('ip', 'ipAddress')
        'Device Category' = $categorie
        'Model'           = Get-Champ $d @('typeName', 'model', 'devType')
        'Location'        = $lieu
        'Site'            = $site
        'Local technique' = $local
        'Status'          = Get-Champ $d @('statusDesc', 'status')
    }
    foreach ($cle in @((Get-Champ $d @('id')), (Get-Champ $d @('symbolId')), $libelle, $e.'IP Address')) {
        if ($cle -and -not $parCle.ContainsKey("$cle")) { $parCle["$cle"] = $e }
    }
    $e
}

# ---------- Liens ----------

Write-Host "Lecture des liens de la vue $VueTopologie…"
$liens = Get-Tout "/plat/res/link?topoId=$VueTopologie" 'link'
Write-Host "  $($liens.Count) liens."
if (-not $liens.Count) { Write-Warning "Aucun lien dans la vue $VueTopologie : vérifiez -VueTopologie et le calcul de topologie de niveau 2 d'IMC." }

function Get-Extremite($lien, [string]$cote) {
    $nom = Get-Champ $lien @("${cote}SymbolName", "${cote}DevName", "${cote}DeviceName", "${cote}Node")
    $e = $null
    foreach ($cle in @((Get-Champ $lien @("${cote}DevId", "${cote}DeviceId")), (Get-Champ $lien @("${cote}SymbolId")), $nom, (Get-Champ $lien @("${cote}DevIp", "${cote}Ip")))) {
        if ($cle -and $parCle.ContainsKey($cle)) { $e = $parCle[$cle]; break }
    }
    if ($e) {
        # IMC écrit souvent le libellé « nom(IP) » : l'IP n'est ajoutée que si elle n'y est pas déjà
        $affiche = if ($e.'IP Address' -and -not $e.'Device Label'.Contains('(')) { "$($e.'Device Label')($($e.'IP Address'))" } else { $e.'Device Label' }
        return @{ Nom = $affiche; Site = $e.Site; Local = $e.'Local technique' }
    }
    return @{ Nom = $nom; Site = ''; Local = '' }
}

$sansEquipement = 0
$lignesLiens = foreach ($l in $liens) {
    $g = Get-Extremite $l 'left'
    $d = Get-Extremite $l 'right'
    if (-not $g.Site -and -not $d.Site) { $sansEquipement++ }
    [pscustomobject][ordered]@{
        'Left Node'             = $g.Nom
        'Left Interface'        = Get-Champ $l @('leftIfDesc', 'leftIfName', 'leftInterface')
        'Left Site'             = $g.Site
        'Left Local technique'  = $g.Local
        'Right Node'            = $d.Nom
        'Right Interface'       = Get-Champ $l @('rightIfDesc', 'rightIfName', 'rightInterface')
        'Right Site'            = $d.Site
        'Right Local technique' = $d.Local
        'Link Speed(bps)'       = Get-Champ $l @('bandWidth', 'speed', 'linkSpeed')
        'Status'                = Get-Champ $l @('statusDesc', 'status')
        'Link Name'             = Get-Champ $l @('name', 'linkName')
    }
}

# ---------- Écriture ----------

if (-not (Test-Path $Dossier)) { New-Item -ItemType Directory -Path $Dossier | Out-Null }
# UTF-8 avec BOM : Excel affiche les accents, FUSAIN lit les deux
$encodage = if ($ps7) { 'utf8BOM' } else { 'UTF8' }
$fichierLiens = Join-Path $Dossier 'reseau-liens.csv'
$fichierEquipements = Join-Path $Dossier 'reseau-equipements.csv'
@($lignesLiens) | Export-Csv -Path $fichierLiens -NoTypeInformation -Encoding $encodage -Delimiter ','
@($lignesEquipements) | Export-Csv -Path $fichierEquipements -NoTypeInformation -Encoding $encodage -Delimiter ','

$sites = @($lignesEquipements | Where-Object { $_.Site } | Select-Object -ExpandProperty Site -Unique)
Write-Host ''
Write-Host "Fichiers écrits :"
Write-Host "  $fichierLiens ($(@($lignesLiens).Count) liens)"
Write-Host "  $fichierEquipements ($(@($lignesEquipements).Count) équipements)"
Write-Host "Sites trouvés dans les emplacements : $(if ($sites.Count) { $sites -join ', ' } else { 'aucun' })"
if ($sansEquipement) { Write-Warning "$sansEquipement lien(s) sans site connu aux deux bouts : renseignez l'emplacement (Location) des équipements dans IMC." }
Write-Host "Dans FUSAIN : Importer un réseau › choisir $fichierLiens (et, pour les icônes, $fichierEquipements)."
