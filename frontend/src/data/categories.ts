import Ionicons from "@react-native-vector-icons/ionicons";
import type { ComponentProps } from 'react';

import type { Category, Priority } from '@/types';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface CategoryMeta extends Category {
  keywords: string[];
  icon: IoniconName;
  defaultPriority: Priority;
  descriptionTemplates: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    categoryId: 'cat_emergency',
    categoryName: 'Emergency Services',
    icon: 'warning-outline',
    defaultPriority: 'Emergency',
    keywords: ['emergency', 'help', 'danger'],
    descriptionTemplates: [
      'Emergency assistance requested by a resident. Immediate facility-team attention is required.',
    ],
  },
  {
    categoryId: 'cat_plumbing',
    categoryName: 'Plumbing',
    icon: 'water-outline',
    defaultPriority: 'High',
    keywords: [
      'leak',
      'water',
      'pipe',
      'tap',
      'faucet',
      'drain',
      'toilet',
      'flush',
      'seepage',
      'flooding',
    ],
    descriptionTemplates: [
      'Visible water leakage identified near the {area}, likely caused by a worn pipe joint or faulty seal. Recommend on-site inspection with pipe wrench and sealant on hand.',
      'Continuous dripping detected from the {area} fixture. Washer or cartridge replacement may be required to stop water wastage.',
      'Slow drainage reported at the {area}. Possible blockage in the trap or downstream pipeline; snaking tool advised.',
    ],
  },
  {
    categoryId: 'cat_electrical',
    categoryName: 'Electrical',
    icon: 'flash-outline',
    defaultPriority: 'Critical',
    keywords: [
      'power',
      'electric',
      'spark',
      'wire',
      'socket',
      'switch',
      'short circuit',
      'mcb',
      'trip',
      'outage',
    ],
    descriptionTemplates: [
      'Intermittent sparking observed at the {area} switchboard. Suspected loose wiring connection; power isolation recommended before inspection.',
      'Complete power loss reported in the {area}. Likely tripped MCB or a downstream short circuit requiring a multimeter check.',
      'Flickering light fixture at the {area}, possibly due to a failing ballast or unstable connection.',
    ],
  },
  {
    categoryId: 'cat_civil',
    categoryName: 'Civil & Structural',
    icon: 'construct-outline',
    defaultPriority: 'Medium',
    keywords: [
      'crack',
      'wall',
      'ceiling',
      'tile',
      'plaster',
      'damp',
      'structural',
      'paint',
      'seepage',
    ],
    descriptionTemplates: [
      'Hairline cracks visible along the {area} wall, potentially from seasonal settling. Recommend plaster patch and repainting.',
      'Damp patch spreading across the {area} ceiling, suggesting seepage from the floor above. Joint inspection needed.',
      'Tile detachment noticed at the {area}. Re-grouting and adhesive reapplication likely required.',
    ],
  },
  {
    categoryId: 'cat_carpentry',
    categoryName: 'Carpentry',
    icon: 'hammer-outline',
    defaultPriority: 'Low',
    keywords: ['door', 'window', 'cupboard', 'hinge', 'lock', 'wood', 'cabinet', 'drawer'],
    descriptionTemplates: [
      'The {area} door is misaligned and not closing properly, likely due to a worn hinge. Carrying spare hinges is advised.',
      'Cupboard shutter at the {area} has come loose from its track; screws or track replacement may be needed.',
      'Window lock at the {area} is jammed, requiring lubrication or hardware replacement.',
    ],
  },
  {
    categoryId: 'cat_hvac',
    categoryName: 'HVAC & Appliances',
    icon: 'snow-outline',
    defaultPriority: 'Medium',
    keywords: [
      'ac',
      'air conditioner',
      'cooling',
      'fridge',
      'refrigerator',
      'appliance',
      'geyser',
      'heater',
      'fan',
    ],
    descriptionTemplates: [
      'Reduced cooling performance reported from the {area} unit. Likely low refrigerant or a clogged filter; gauge set recommended.',
      'Unusual noise coming from the {area} appliance during operation, suggesting a loose fan blade or worn bearing.',
      'The {area} unit is not powering on. Suspect a tripped thermal cutoff or faulty control board.',
    ],
  },
  {
    categoryId: 'cat_pest',
    categoryName: 'Pest Control',
    icon: 'bug-outline',
    defaultPriority: 'Medium',
    keywords: ['pest', 'cockroach', 'rat', 'mosquito', 'termite', 'ants', 'insect', 'rodent'],
    descriptionTemplates: [
      'Pest activity reported near the {area}, consistent with a minor infestation. Recommend scheduling a licensed pest-control visit.',
      'Signs of termite activity spotted around the {area} woodwork; treatment and follow-up inspection advised.',
    ],
  },
  {
    categoryId: 'cat_lift',
    categoryName: 'Lift & Elevator',
    icon: 'swap-vertical-outline',
    defaultPriority: 'Critical',
    keywords: ['lift', 'elevator', 'stuck', 'cabin'],
    descriptionTemplates: [
      'Irregular stopping reported in the {area} elevator cabin. Recommend third-party elevator technician inspection of leveling sensors.',
      'Unusual grinding noise from the {area} lift shaft, possibly indicating worn cables or guide rails.',
    ],
  },
  {
    categoryId: 'cat_security',
    categoryName: 'Security & Common Area',
    icon: 'shield-checkmark-outline',
    defaultPriority: 'High',
    keywords: ['cctv', 'camera', 'gate', 'security', 'intercom', 'boom barrier'],
    descriptionTemplates: [
      'CCTV feed from the {area} appears offline. Likely a network or power connection issue at the camera junction.',
      'Main gate / boom barrier at the {area} is not responding to remote input, suggesting a motor or sensor fault.',
    ],
  },
  {
    categoryId: 'cat_housekeeping',
    categoryName: 'Cleaning & Housekeeping',
    icon: 'sparkles-outline',
    defaultPriority: 'Low',
    keywords: ['garbage', 'cleaning', 'trash', 'waste', 'housekeeping', 'dirty'],
    descriptionTemplates: [
      'Uncollected waste accumulating near the {area}. Recommend an additional housekeeping round and bin servicing.',
      'Common area at the {area} requires deep cleaning following resident-reported spillage.',
    ],
  },
];

export function getCategoryById(categoryId: string): CategoryMeta {
  return CATEGORIES.find((c) => c.categoryId === categoryId) ?? CATEGORIES[0];
}
