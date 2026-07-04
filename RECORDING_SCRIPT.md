# The announcer recording script

Every line the announcer speaks maps to a file: lowercase the line,
replace every run of non-letters/digits with `_`, trim `_` from the ends,
cap at 60 chars → `assets/voice/<that>.ogg`. If the file exists, the game
plays it; if not, the robot voice covers it. **Record any subset, in any
order, and ship as you go.** Same rule works for ElevenLabs batch renders.

Recording tips (for the family session): quiet room, phone voice-memo is
fine, one line per take, leave half a second of silence around each. Big
smiles — you can hear them. Kids on the fun lines is the whole point.
Convert with: `ffmpeg -i take.m4a -c:a libvorbis -q:a 5 assets/voice/<name>.ogg`

## Priority lines (the ones heard every run)

| Say | File name |
|---|---|
| Wave 1! Here they come! | `wave_1_here_they_come.ogg` |
| Wave 2! Here they come! | `wave_2_here_they_come.ogg` |
| …same pattern through… | `wave_11_here_they_come.ogg` |
| Wave 4! Here comes MOWTRON 9000! You can do it! | `wave_4_here_comes_mowtron_9000_you_can_do_it.ogg` |
| Wave 8! Here comes THE SUCC-5000! You can do it! | `wave_8_here_comes_the_succ_5000_you_can_do_it.ogg` |
| Wave 12! Here comes BUNNYTRON! You can do it! | `wave_12_here_comes_bunnytron_you_can_do_it.ogg` |
| Hooray! The boss is scrapped! Amazing! | `hooray_the_boss_is_scrapped_amazing.ogg` |
| CONGRATULATIONS! You beat BUNNYTRON! You saved the whole meadow! HOORAY! | `congratulations_you_beat_bunnytron_you_saved_the_whole_me.ogg` |
| Nature wins! Hooray! You saved all the critters! | `nature_wins_hooray_you_saved_all_the_critters.ogg` |
| Ouch! The piper got bonked! Great try! Play again! | `ouch_the_piper_got_bonked_great_try_play_again.ogg` |
| Oh no, the mob is gone! Great try! Play again! | `oh_no_the_mob_is_gone_great_try_play_again.ogg` |
| Oh no! Save the mob! Run to a cage, fast! | `oh_no_save_the_mob_run_to_a_cage_fast.ogg` |
| Wild critters spotted! Follow the golden arrow! | `wild_critters_spotted_follow_the_golden_arrow.ogg` |
| Second chance! The parade rises again! 2 left! | `second_chance_the_parade_rises_again_2_left.ogg` (also `_1_left`, `_0_left`) |
| The crossroads market is open! Spend acorns, or save them! | `the_crossroads_market_is_open_spend_acorns_or_save_them.ogg` |
| Pick a new friend for your roster! | `pick_a_new_friend_for_your_roster.ogg` |
| Rain is coming! Robots hate rain! | `rain_is_coming_robots_hate_rain.ogg` |
| Whoosh! Hold onto your hats! | `whoosh_hold_onto_your_hats.ogg` |
| Thunderstorm! Watch out for the sky circles! | `thunderstorm_watch_out_for_the_sky_circles.ogg` |
| Yummy apple! | `yummy_apple.ogg` |
| You got an acorn! Collect acorns to unlock new critters! | `you_got_an_acorn_collect_acorns_to_unlock_new_critters.ogg` |
| Mob Rule! Pick a save file! | `mob_rule_pick_a_save_file.ogg` |
| PIP THE PIPER! | `pip_the_piper.ogg` |
| BAM THE DRUMMER! | `bam_the_drummer.ogg` |
| VIVI THE FIDDLER! | `vivi_the_fiddler.ogg` |
| ECHO THE CONDUCTOR! | `echo_the_conductor.ogg` |
| Player two joined the parade! | `player_two_joined_the_parade.ogg` |
| Kawaii mode! | `kawaii_mode.ogg` |

Everything else (species join lines, quests, camp purchases, difficulty
names…) follows the same rule — say the line in-game with the robot voice,
note the wording, apply the formula. A future tools script can enumerate
the full catalog if we go the TTS-batch route.
