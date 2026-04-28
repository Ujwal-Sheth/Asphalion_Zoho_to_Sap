SAP Fields --> Zoho Fields with Api Names
Type of Product <Tipodeproducto> --> Type of Product Type_of_Product
Description <Name>--> Description Description
Posting Date <PostingDate> ---> Creation Date Creation_Date
Valid To <ValidityPeriodPeriodTerms > --> Closing Date Closing_Date
Orgin <Origen>--> Source Source
Category <Categoria> --> Category Category
Discount <Discount> --> Discount Discount
Sales Unit	<SalesUnitParty> --> pick from source pick list eSub RegOps,DATA RegOps, CMC etc..
Distribution Channel	<DistributionChannelCode>  ---> Direct Sales only option is there
Therapeutical area <reateraputica>--> Therapeutical area Therapeutical_area
Legal basis <Baselegal>---> Legal basis Legal basis
Procedure <Procedimiento1>--> Procedure Procedure
Hunting/Farming/Cross Selling <HuntingFarming>-->Hunting/Farming/Cross Selling HuntingFarming
Payment Terms <CashDiscountTermsCode> --> Payment Terms Payment_Terms
Total sales Value	<EstimacionIngresos> ---> Amount Amount	 


Chance of Success --> Probability(%)

Tipodeproducto
102 - Single Project (Do not use)
25 - Single project
Z01 - Cont. collab. project
Z02 - Grant project (EU-FP, etc.)
Z04 - Referral (only to invoice)


Source<Origen>
001 - Evento/feria (indicar en el campo campaña)
003 - Campaña (indicar en el campo campaña)
004 - Lead digital
005 - Plataforma de reuniones en línea
101 - Knowledge Center
102 - EU Reference
Z01 - Socio comercial/Referral (indicar partes implicadas)
Z02 - Referencia de otro cliente (especificar cliente)
Z03 - Red personal
Z05 - Farming


<Categoria>

Z001 - eSub RegOps
Z002 - DATA RegOps
Z003 - CMC
Z004 - DW
Z005 - MedTech
Z006 - LCM
Z007 - PV
Z008 - European Projects
Z009 - Transversal
Z010 - Business Development
Z011 - Others


SalesUnit	<SalesUnitParty>
1170 - AS_eSub RegOps
1190 - AS_DATA RegOps
1101 - AS_CMC
1150 - AS_DW
1130 - AS_MD
1102 - AS_LCM
1160 - AS_PV
1310 - AS_BD
1180 - AS_OTHERS

<reateraputica>
136 - A - Alimentary tract and metabolism
137 - B - Blood and blood forming organs
138 - C - Cardiovascular system
139 - D - Dermatologicals
140 - G - Genito-urinary system and sex hormones
141 - H - Systemic hormonal preparations, excluding sex hormones and insulins
142 - J - Antiinfectives for systemic use
143 - L - Antineoplastic and immunomodulating agents
144 - M - Musculo-skeletal system
145 - N - Nervous system
146 - P - Antiparasitic products, insecticides and repellents
147 - R - Respiratory system
148 - S - Sensory organs
149 - V - Various (allergens, diagnostic agents, etc.)
150 - Others (if the product is not a drug)
151 - Not applicable (when there is not product)


<Baselegal>
153 - Full dossier (8(3), NDA505(b)(1), BLA351(a), NDS, etc.)
154 - WEU (10(a))
155 - Fixed Dose Combination (10(b), etc.)
156 - Generic (10(1), ANDA, ANDS, etc.)
157 - Hybrid / Mixed / Modified / etc. (10(3), NDA505(b)(2), etc.)
158 - Biosimilar (10(4), BLA 351(k), etc.)
159 - Medical Device certification / registration (EU DIR / MDR, 510(k), etc.)
160 - Others
161 - Not applicable (NA)
162 - To be defined (TBD)


<Procedimiento1>
164 - EMA/FDA procedure during development (excluding meetings/SA/pre-IND, etc.)
165 - Agency meeting (SA, pre-IND, pre-submission, etc.)
166 - Clinical Trial Application (CTA) / Investigational New Drug (IND)
167 - Orphan Drug Designation (ODD)
168 - Paediatric Investigation Plan (PIP) / PSP / WR / BPCA / etc.
169 - EMA Centralised Procedure (CP)
170 - EU Decentralised Procedure (DCP) / Mutual Recognition Pr. (MRP) / Repeat Use Pr. (RUP)
171 - National Marketing Authorization Application (NP, MAA, NDA/BLA, NDS, etc.)
172 - Active Substance Master File (ASMF) / Drug Master File (DMF)
173 - Certi. Suitab. to monographs European Pharmacopoeia (CEP)
174 - Medical Device certification / notification
175 - Pricing and Reimbursement (P&R)
176 - Small and Medium-sized Enterprises (SME) application
177 - Others
178 - Not applicable (NA)
179 - Development projects
180 - Local Contact

<HuntingFarming>
131 - Hunting
132 - Farming
133 - Cross Selling

<CashDiscountTermsCode>
ZC01 - 120 days net
1003 - 30 days net
ZC09 - 30 days net, fixed day 15
ZC08 - 30 days net, fixed day 20
ZC10 - 30 days net, fixed day 25
ZC05 - 30 days net, fixed day 26
ZC07 - 30 days net, fixed day 30
ZC02 - 40 days net
1004 - 45 days net
ZC11 - 45 days net, fixed day 5
1005 - 60 days net
ZC06 - 60 days net, fixed day 25
ZC12 - 60 days net, fixed day 30
ZC03 - 75 days net
ZC04 - 90 days net
1001 - Payable immediately due net



Type of Product

102 - Not applicable (NA)
103 -To be defined (TBD)
104 - SMD NCEs/NMEs
105 - SMD Known molecules
106 - SMD APIs only
107 - SMD Medicinal gases
108 - SMD Fixed dose combinations
109 - SMD Others
110 - BIO Peptides and small proteins
111 - BIO Large proteins, antibodies, fusion proteins
112 - BIO Vaccines, immuno-therapeutic products
113 - BIO ATMP cell therapies
114 - BIO ATMP gene therapies
115 - BIO ATMP tissue engineered products
116 - BIO ATMP combination product
117 - BIO Others
118 - MD Biomarkers/IVDs
119 - MD Borderline products
120 - MD Device of combination product
121 - MD Electromechanics
122 - MD Materials and biomaterials
123 - MD Software
124 - MD Substance-based
125 - MD Others
126 - Combination products others
127 - Complex molecules (not biologicals)
128 - Nanomedicines
129 - Herbal medicinal products
130 - Cosmetics
131 - Food supplements
132 - Software (eCTD, PhV, RIM, etc.)
133 - Veterinary products
134 - Others