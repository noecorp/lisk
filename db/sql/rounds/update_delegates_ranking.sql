/*
 * Copyright © 2018 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */


/*
  DESCRIPTION: ?

  PARAMETERS:
    - change - can be either '+ 1' or '- 1'
    - outsiders - array of something?
*/

WITH ranking_update AS
    (
        SELECT 
            row_number() OVER (ORDER BY vote DESC, "publicKey" ASC) AS rank
            , "publicKey"
        FROM 
            mem_accounts
        WHERE "isDelegate" = 1
    ) 

UPDATE 
    mem_accounts 
SET 
    rank = ranking_update.rank 
FROM 
    ranking_update 
WHERE 
    mem_accounts."publicKey" = ranking_update."publicKey";