'use client';

import React, {useState} from 'react';
import {MapPin, Plus, Trash2, Calendar as CalendarIcon, Clock, Bike, Car, Truck} from 'lucide-react';
import {format} from 'date-fns';
import {cn} from '@/lib/utils';
import {Button} from '@/components/ui/button';
import {Calendar} from '@/components/ui/calendar';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group';
import {Separator} from '@/components/ui/separator';

type Dropoff = {
  id: number;
  address: string;
};

export default function NewDeliveryPage() {
  const [pickup, setPickup] = useState('123 Main St, Anytown, USA');
  const [dropoffs, setDropoffs] = useState<Dropoff[]>([{id: 1, address: ''}]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('14:30');
  const [vehicle, setVehicle] = useState('car');
  const [price, setPrice] = useState(25.5);

  const handleAddDropoff = () => {
    setDropoffs([...dropoffs, {id: Date.now(), address: ''}]);
  };

  const handleRemoveDropoff = (id: number) => {
    setDropoffs(dropoffs.filter(d => d.id !== id));
  };

  const handleDropoffChange = (id: number, value: string) => {
    setDropoffs(dropoffs.map(d => (d.id === id ? {...d, address: value} : d)));
  };

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Create a New Delivery</CardTitle>
            <CardDescription>
              Enter the details for your single or multi-stop delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="pickup">Pickup Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="pickup"
                  value={pickup}
                  onChange={e => setPickup(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-3">
              <Label>Drop-off Locations</Label>
              {dropoffs.map((dropoff, index) => (
                <div key={dropoff.id} className="flex items-center gap-2">
                  <div className="relative flex-grow">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Drop-off Location ${index + 1}`}
                      value={dropoff.address}
                      onChange={e => handleDropoffChange(dropoff.id, e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {dropoffs.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDropoff(dropoff.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" onClick={handleAddDropoff} className="mt-2">
                <Plus className="mr-2 h-4 w-4" /> Add Drop-off
              </Button>
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-3">
                <Label>Schedule</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <Label>Vehicle Type</Label>
                <RadioGroup
                  defaultValue="car"
                  className="grid grid-cols-3 gap-4"
                  onValueChange={setVehicle}
                >
                  <div>
                    <RadioGroupItem value="bike" id="bike" className="peer sr-only" />
                    <Label
                      htmlFor="bike"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <Bike className="mb-3 h-6 w-6" />
                      Bike
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="car" id="car" className="peer sr-only" />
                    <Label
                      htmlFor="car"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <Car className="mb-3 h-6 w-6" />
                      Car
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="truck" id="truck" className="peer sr-only" />
                    <Label
                      htmlFor="truck"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <Truck className="mb-3 h-6 w-6" />
                      Truck
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-1">
        <Card className="rounded-2xl shadow-sm sticky top-20">
          <CardHeader>
            <CardTitle>Delivery Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated ETA</span>
              <span>35-45 mins</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Distance</span>
              <span>8.2 miles</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between font-semibold">
              <span className="text-lg">Price</span>
              <span className="text-2xl">${price.toFixed(2)}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button size="lg" className="w-full">
              Confirm Delivery
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
